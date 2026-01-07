# Transactional Outbox + Worker สำหรับ HR Payroll API

บทความนี้สรุปแนวทางออกแบบ Transactional Outbox + Worker ที่เข้ากับโครงสร้างปัจจุบันของ API (post-commit hook + internal event bus) เพื่อให้การส่ง integration events มีความทนทานและลดความเสี่ยง event หายเมื่อ process ล่ม

---

## ทำไมต้อง Outbox
ปัจจุบัน `eventbus` เป็น in-memory และ fire-and-forget (ยิง goroutine ทันที) จึงมีความเสี่ยง:
- process ล่มระหว่าง publish → event หาย
- ไม่มี retry/backoff
- ไม่มี visibility ว่ามี event ค้างอยู่เท่าไร

Transactional Outbox แก้ปัญหาโดย:
- บันทึก event ลง DB ใน transaction เดียวกับ business data
- มี worker ที่คอยส่งออก (publish) พร้อม retry/backoff
- ทำให้ event “ไม่หลุด” แม้ process ล่ม

---

## แนวคิดภาพรวม

```
[Request]
    |
    v
[Command Handler]
    |  (DB tx)
    |-- write business tables
    |-- insert outbox_events
    v
[Commit]
    |
    v
[Worker] ----> [eventbus.Publish] ----> [Subscribers]
      ^                 |
      |                 v
   retry/backoff    activitylog, etc.
```

> รูปแบบนี้ยังคงใช้ `internal event bus` ต่อได้ แต่เปลี่ยนจาก “ยิงทันที” → “บันทึกแล้วค่อยส่ง”

---

## Data Model (ตัวอย่าง)

```sql
CREATE TABLE outbox_events (
  id              uuid PRIMARY KEY,
  aggregate_type  text NOT NULL,
  aggregate_id    uuid NOT NULL,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'pending',
  attempts        int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text NULL,
  published_at    timestamptz NULL
);

CREATE INDEX idx_outbox_pending
  ON outbox_events (status, next_attempt_at);
```

ค่า status แนะนำ: `pending`, `processing`, `published`, `failed`

---

## การเขียน Event (Write Path)
ตัวอย่างใน command handler ที่มี `transactor.WithinTransaction` อยู่แล้ว

```go
// ตัวอย่างใน handler หลัง update สำเร็จ
err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, registerHook func(transactor.PostCommitHook)) error {
    // 1) ทำงานหลัก
    company, err := h.repo.UpdateByID(ctxTx, cmd.ID, cmd.Code, cmd.Name, cmd.Status, cmd.ActorID)
    if err != nil {
        return err
    }

    // 2) บันทึก Outbox ใน tx เดียวกัน
    payload := map[string]interface{}{
        "companyId": company.ID,
        "code":      company.Code,
        "name":      company.Name,
        "status":    company.Status,
        "actorId":   cmd.ActorID,
    }
    if err := h.outbox.Insert(ctxTx, OutboxEvent{
        AggregateType: "COMPANY",
        AggregateID:   company.ID,
        EventType:     "CompanyUpdated",
        Payload:       payload,
    }); err != nil {
        return err
    }

    // 3) (Optional) แจ้ง worker หลัง commit เพื่อให้ส่งเร็วขึ้น
    registerHook(func(ctx context.Context) error {
        h.notifier.Notify() // เช่น signal ไป worker
        return nil
    })

    return nil
})
```

> จุดสำคัญคือ “insert outbox_events อยู่ใน transaction เดียวกับธุรกิจ”

---

## Repository (ตัวอย่าง)
ใช้ pattern เดียวกับ repository อื่น ๆ (`transactor.DBTXContext`)

```go
type OutboxRepository struct {
    dbCtx transactor.DBTXContext
}

func (r *OutboxRepository) Insert(ctx context.Context, ev OutboxEvent) error {
    db := r.dbCtx(ctx)
    _, err := db.ExecContext(ctx, `
        INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
        VALUES ($1, $2, $3, $4, $5)
    `, ev.ID, ev.AggregateType, ev.AggregateID, ev.EventType, ev.Payload)
    return err
}
```

---

## Worker (Publish + Retry)

```go
func (w *Worker) Run(ctx context.Context) {
    ticker := time.NewTicker(2 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            w.processBatch(ctx)
        }
    }
}

func (w *Worker) processBatch(ctx context.Context) {
    // เลือก event ที่พร้อมส่งแบบ lock-safe
    events, err := w.repo.LockPending(ctx, 50)
    if err != nil {
        w.log.Error("outbox fetch failed", zap.Error(err))
        return
    }

    for _, ev := range events {
        if err := w.publisher.Publish(ctx, ev); err != nil {
            w.repo.MarkFailed(ctx, ev.ID, err)
            continue
        }
        w.repo.MarkPublished(ctx, ev.ID)
    }
}
```

ตัวอย่าง SQL สำหรับ lock แบบ `SKIP LOCKED`:

```sql
SELECT * FROM outbox_events
WHERE status = 'pending'
  AND next_attempt_at <= now()
ORDER BY occurred_at
FOR UPDATE SKIP LOCKED
LIMIT 50;
```

---

## Publisher เชื่อมกับ internal event bus

```go
func (p *Publisher) Publish(ctx context.Context, ev OutboxEvent) error {
    switch ev.EventType {
    case "CompanyUpdated":
        p.eventBus.Publish(events.LogEvent{ ... })
    default:
        return fmt.Errorf("unknown event type: %s", ev.EventType)
    }
    return nil
}
```

> จุดนี้ยังคงใช้ `eventbus.Publish` เดิมได้ แต่เรียกผ่าน worker เพื่อให้มี durability

---

## Retry / Backoff
แนวทางง่าย ๆ:
- `attempts++`
- `next_attempt_at = now() + (attempts^2 seconds)` หรือ exponential
- เกิน limit (เช่น 10) → `status = failed`

---

## Idempotency
เพื่อกัน event ซ้ำ:
- ใส่ `event_id` ใน payload
- consumer สามารถบันทึก `processed_event_id` หากจำเป็น

---

## สรุป
Transactional Outbox + Worker ช่วยให้ integration events “ไม่หลุด” และสามารถ retry ได้อย่างเป็นระบบ โดยยังคงใช้โครงสร้างเดิมของ API ได้:
- ทำงานหลัก → insert outbox ใน tx เดียวกัน
- ใช้ post-commit hook เพื่อ trigger worker
- worker เป็นผู้ publish ไปยัง internal event bus

หากต้องการ ผมสามารถช่วยร่าง proposal/spec ตาม OpenSpec ต่อให้เลย

