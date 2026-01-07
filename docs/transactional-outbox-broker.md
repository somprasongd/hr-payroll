# Transactional Outbox + Worker ส่งไป Message Broker (RabbitMQ)

บทความนี้ต่อยอดจาก `docs/transactional-outbox.md` โดยเปลี่ยนปลายทางจาก internal event bus ไปเป็น **Message Broker** เพื่อรองรับ integration events แบบข้ามระบบได้จริงจัง

ในโปรเจกต์นี้เลือก **RabbitMQ** เพราะ:
- ติดตั้งง่ายกว่า Kafka
- เหมาะกับปริมาณ event กลาง ๆ (HR/Payroll)
- มีแนวทาง retry / DLQ ชัดเจน

> หากต้องการ throughput สูงมากหรือ stream processing ระยะยาวค่อยพิจารณา Kafka เพิ่มเติม

---

## ภาพรวม Flow

```
[Command Handler]
   | (DB tx)
   |-- write business tables
   |-- insert outbox_events
   v
[Commit]
   |
   v
[Outbox Worker]
   |  publish
   v
[RabbitMQ Exchange]
   |
   +--> [Queue: activity-log]
   +--> [Queue: audit]
   +--> [Queue: payroll-analytics]
```

---

## Schema Outbox (เหมือนเดิม)

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
```

---

## RabbitMQ Topology

แนะนำใช้ **topic exchange** เพื่อ route ตาม event type

```
Exchange: hrms.events (topic)
Routing keys:
  company.updated
  payroll.run.created
  worklog.ft.created

Queues:
  activity-log      binds company.* , worklog.*
  payroll-analytics binds payroll.*
```

---

## Worker Publisher (ตัวอย่าง)

```go
// ตัวอย่าง publisher ใช้ amqp091-go
// go get github.com/rabbitmq/amqp091-go

type BrokerPublisher struct {
    ch       *amqp.Channel
    exchange string
}

func NewBrokerPublisher(conn *amqp.Connection, exchange string) (*BrokerPublisher, error) {
    ch, err := conn.Channel()
    if err != nil {
        return nil, err
    }
    if err := ch.ExchangeDeclare(
        exchange,
        "topic",
        true,  // durable
        false, // auto-delete
        false,
        false,
        nil,
    ); err != nil {
        return nil, err
    }
    return &BrokerPublisher{ch: ch, exchange: exchange}, nil
}

func (p *BrokerPublisher) Publish(ctx context.Context, ev OutboxEvent) error {
    body, err := json.Marshal(ev.Payload)
    if err != nil {
        return err
    }

    routingKey := mapEventToRoutingKey(ev.EventType)

    return p.ch.PublishWithContext(
        ctx,
        p.exchange,
        routingKey,
        false,
        false,
        amqp.Publishing{
            ContentType:  "application/json",
            DeliveryMode: amqp.Persistent, // สำคัญ: durable
            MessageId:    ev.ID.String(),
            Timestamp:    time.Now(),
            Body:         body,
        },
    )
}
```

### mapping event_type → routing_key

```go
func mapEventToRoutingKey(eventType string) string {
    switch eventType {
    case "CompanyUpdated":
        return "company.updated"
    case "PayrollRunCreated":
        return "payroll.run.created"
    default:
        return "unknown"
    }
}
```

---

## Worker Process (ย่อ)

```go
func (w *Worker) processBatch(ctx context.Context) {
    events, err := w.repo.LockPending(ctx, 50)
    if err != nil {
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

> ตรงนี้เหมือนบทความแรก ต่างกันที่ `publisher` ชี้ไป RabbitMQ แทน internal event bus

---

## Consumer (ตัวอย่างฝั่ง Service อื่น)

```go
func StartConsumer(conn *amqp.Connection) error {
    ch, err := conn.Channel()
    if err != nil {
        return err
    }

    q, err := ch.QueueDeclare(
        "activity-log",
        true,  // durable
        false,
        false,
        false,
        nil,
    )
    if err != nil {
        return err
    }

    if err := ch.QueueBind(q.Name, "company.*", "hrms.events", false, nil); err != nil {
        return err
    }

    msgs, err := ch.Consume(q.Name, "", false, false, false, false, nil)
    if err != nil {
        return err
    }

    go func() {
        for m := range msgs {
            // idempotency: ตรวจ MessageId ก่อนทำงาน
            if err := handleMessage(m); err != nil {
                _ = m.Nack(false, true)
                continue
            }
            _ = m.Ack(false)
        }
    }()

    return nil
}
```

---

## Retry / DLQ

แนวทางที่แนะนำ:
- ใน **Outbox Worker**: retry หาก publish ล้มเหลว (เช่น broker down)
- ใน **Consumer**: หาก handle fail ให้ Nack/requeue หรือส่งเข้า DLQ

RabbitMQ example:
- queue ตั้ง `x-dead-letter-exchange` ไป DLQ

---

## การเชื่อมเข้ากับ main (แนวทาง)

```go
conn, _ := amqp.Dial(cfg.RabbitURL)
producer, _ := outbox.NewBrokerPublisher(conn, "hrms.events")
worker := outbox.NewWorker(outboxRepo, producer, outbox.WithInterval(2*time.Second))

go worker.Run(ctx)
```

---

## สรุป
- Transactional Outbox ทำให้ event ไม่หลุด
- Worker ส่ง event ไป RabbitMQ แบบ durable
- consumer แยกเป็น service อื่นได้ง่าย (activity log, analytics, etc.)

หากต้องการ ผมช่วยร่าง spec และตัวอย่าง migration สำหรับ outbox + broker ได้ครับ

