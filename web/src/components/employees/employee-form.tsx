"use client";

import { useRouter } from "@/i18n/routing";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, User, X } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DismissibleAlert } from "@/components/ui/dismissible-alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  CreateEmployeeRequest,
  Employee,
  UpdateEmployeeRequest,
  employeeService,
} from "@/services/employee.service";
import {
  AllMasterData,
  masterDataService,
} from "@/services/master-data.service";
import { EmployeeTypeBadge } from "../common/employee-type-badge";
import { AccumulationView } from "./accumulation-view";
import { DocumentTab } from "./document-tab";

interface EmployeeFormProps {
  initialData?: Employee;
  onSubmit: (
    data: CreateEmployeeRequest | UpdateEmployeeRequest
  ) => Promise<void>;
  isEditing?: boolean;
  defaultTab?: string;
}

export function EmployeeForm({
  initialData,
  onSubmit,
  isEditing = false,
  defaultTab = "personal",
}: EmployeeFormProps) {
  const t = useTranslations("Employees");
  const tAccum = useTranslations("Accumulation");
  const tDocs = useTranslations("Documents");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [masterData, setMasterData] = useState<AllMasterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Refs for auto-focus
  const personalFirstInputRef = React.useRef<HTMLInputElement>(null);
  const employmentInputRef = React.useRef<HTMLInputElement>(null);
  const financialInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Photo upload state
  const [photoId, setPhotoId] = useState<string>(initialData?.photoId || "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletePhotoDialogOpen, setDeletePhotoDialogOpen] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  // Load existing photo preview
  React.useEffect(() => {
    if (initialData?.photoId) {
      employeeService
        .fetchPhotoWithCache(initialData.photoId)
        .then(setPhotoPreview);
    }
  }, [initialData?.photoId]);

  const employeeSchema = z.object({
    // Personal Info
    titleId: z.string().min(1, t("validation.required")),
    firstName: z.string().min(1, t("validation.required")),
    lastName: z.string().min(1, t("validation.required")),
    idDocumentTypeId: z.string().min(1, t("validation.required")),
    idDocumentNumber: z.string().min(1, t("validation.required")),
    idDocumentOtherDescription: z.string().optional(),
    nickname: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email(t("validation.email")).optional().or(z.literal("")),

    // Employment Info
    employeeNumber: z.string().min(1, t("validation.required")),
    employeeTypeId: z.string().min(1, t("validation.required")),
    departmentId: z.string().optional(),
    positionId: z.string().optional(),
    employmentStartDate: z.string().min(1, t("validation.required")),
    employmentEndDate: z.string().optional().nullable(),

    // Financial Info
    basePayAmount: z.coerce.number().gt(0, t("validation.positive")),
    bankName: z.string().optional(),
    bankAccountNo: z.string().optional(),

    // Benefits
    ssoContribute: z.boolean().default(false),
    ssoDeclaredWage: z.coerce.number().optional(),
    ssoHospitalName: z.string().optional(),
    providentFundContribute: z.boolean().default(false),
    providentFundRateEmployee: z.coerce.number().optional(),
    providentFundRateEmployer: z.coerce.number().optional(),
    withholdTax: z.boolean().default(false),

    // Allowances
    allowHousing: z.boolean().default(false),
    allowWater: z.boolean().default(false),
    allowElectric: z.boolean().default(false),
    allowInternet: z.boolean().default(false),
    allowDoctorFee: z.boolean().default(false),
    allowAttendanceBonusNoLate: z.boolean().default(false),
    allowAttendanceBonusNoLeave: z.boolean().default(false),
  }).superRefine((data, ctx) => {
    const selectedDocType = masterData?.idDocumentTypes?.find(
      (t) => (t.id || t.ID) === data.idDocumentTypeId
    );
    const isOther =
      (selectedDocType?.code || selectedDocType?.Code || "").toLowerCase() ===
      "other";

    if (isOther) {
      if (!data.idDocumentOtherDescription || data.idDocumentOtherDescription.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.required"),
          path: ["idDocumentOtherDescription"],
        });
      }
    }
  });

  type EmployeeFormValues = z.infer<typeof employeeSchema>;

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema) as any,
    defaultValues: {
      titleId: initialData?.titleId || "",
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      idDocumentTypeId: initialData?.idDocumentTypeId || "",
      idDocumentNumber: initialData?.idDocumentNumber || "",
      idDocumentOtherDescription: initialData?.idDocumentOtherDescription || "",
      nickname: initialData?.nickname || "",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      employeeNumber: initialData?.employeeNumber || "",
      employeeTypeId: initialData?.employeeTypeId || "",
      departmentId: initialData?.departmentId || "",
      positionId: initialData?.positionId || "",
      employmentStartDate:
        initialData?.employmentStartDate ||
        new Date().toISOString().split("T")[0],
      employmentEndDate: initialData?.employmentEndDate || null,
      basePayAmount: initialData?.basePayAmount || 0,
      bankName: initialData?.bankName || "",
      bankAccountNo: initialData?.bankAccountNo || "",
      ssoContribute: initialData?.ssoContribute || false,
      // Use 0 when ssoContribute is false, otherwise use API value
      ssoDeclaredWage: initialData?.ssoContribute ? (initialData?.ssoDeclaredWage || 0) : 0,
      ssoHospitalName: initialData?.ssoHospitalName || "",
      providentFundContribute: initialData?.providentFundContribute || false,
      providentFundRateEmployee:
        (initialData?.providentFundRateEmployee || 0) * 100,
      providentFundRateEmployer:
        (initialData?.providentFundRateEmployer || 0) * 100,
      withholdTax: initialData?.withholdTax ?? false,
      allowHousing: initialData?.allowHousing || false,
      allowWater: initialData?.allowWater || false,
      allowElectric: initialData?.allowElectric || false,
      allowInternet: initialData?.allowInternet || false,
      allowDoctorFee: initialData?.allowDoctorFee || false,
      allowAttendanceBonusNoLate:
        initialData?.allowAttendanceBonusNoLate || false,
      allowAttendanceBonusNoLeave:
        initialData?.allowAttendanceBonusNoLeave || false,
    },
  });

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const data = await masterDataService.getAll();
        setMasterData(data);
      } catch (error) {
        console.error("Failed to fetch master data", error);
      }
    };
    fetchMasterData();
  }, []);

  // Auto-focus first input when tab changes
  React.useEffect(() => {
    // Use setTimeout to ensure the tab content is rendered
    const timeoutId = setTimeout(() => {
      switch (activeTab) {
        case 'personal':
          personalFirstInputRef.current?.focus();
          break;
        case 'employment':
          employmentInputRef.current?.focus();
          break;
        case 'financial':
          financialInputRef.current?.focus();
          break;
        // accumulation and documents tabs don't have text inputs to focus
      }
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setSubmitError(t("photoUploadError") + " (max 2MB)");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setSubmitError(t("photoUploadError") + " (image only)");
      return;
    }

    setUploadingPhoto(true);
    setSubmitError(null);

    try {
      const response = await employeeService.uploadPhoto(file);
      setPhotoId(response.id);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      // Check for 409 Conflict (duplicate photo)
      if (axiosError?.response?.status === 409) {
        setSubmitError(t("photoDuplicateError"));
      } else {
        const apiError = err as Error;
        setSubmitError(apiError.message || t("photoUploadError"));
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    // Open confirmation dialog if we're editing an existing employee with a photo
    if (isEditing && initialData?.id && (photoId || initialData?.photoId)) {
      setDeletePhotoDialogOpen(true);
    } else {
      // For new employees or locally uploaded photos not yet saved, just clear the state
      setPhotoId("");
      setPhotoPreview(null);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  };

  const handleDeletePhotoConfirm = async () => {
    if (!initialData?.id) return;

    setDeletingPhoto(true);
    try {
      await employeeService.deletePhoto(initialData.id);
      setPhotoId("");
      setPhotoPreview(null);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      setDeletePhotoDialogOpen(false);
    } catch (err) {
      console.error("Failed to delete photo:", err);
      setSubmitError(t("photoDeleteError"));
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleSubmit = async (data: EmployeeFormValues) => {
    setLoading(true);
    setSubmitError(null);
    try {
      // Transform data: convert percentage to decimal for API
      const transformedData = {
        ...data,
        photoId: photoId || undefined,
        providentFundRateEmployee: data.providentFundRateEmployee
          ? data.providentFundRateEmployee / 100
          : 0,
        providentFundRateEmployer: data.providentFundRateEmployer
          ? data.providentFundRateEmployer / 100
          : 0,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onSubmit(transformedData as any);
      setSubmitSuccess(true);
      // Clear success message after 5 seconds
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error: any) {
      console.error(error);
      const errorMessage =
        error?.response?.data?.message || error?.message || t("submitError");
      setSubmitError(errorMessage);
      setSubmitSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Watch for changes to auto-fill SSO Declared Wage
  const ssoContribute = form.watch("ssoContribute");
  const basePayAmount = form.watch("basePayAmount");
  const employeeTypeId = form.watch("employeeTypeId");
  const firstName = form.watch("firstName");
  const lastName = form.watch("lastName");
  const nickname = form.watch("nickname");
  const employeeNumber = form.watch("employeeNumber");

  // Fetch Payroll Config for default hourly rate
  const [payrollConfig, setPayrollConfig] = useState<any>(null);
  // Track if we've already auto-filled the hourly rate for part-time
  const hasAutoFilledHourlyRate = React.useRef(false);
  // Track the last employee type to detect changes
  // Initialize with initialData value in edit mode to prevent auto-fill on first render
  const lastEmployeeTypeRef = React.useRef<string | null>(initialData?.employeeTypeId || null);
  // Track previous ssoContribute value to detect toggling from false to true
  const prevSsoContributeRef = React.useRef<boolean>(initialData?.ssoContribute || false);

  useEffect(() => {
    // Skip if already fetched
    if (payrollConfig) return;

    const fetchConfig = async () => {
      try {
        const config = await import("@/services/payroll-config.service").then(
          (m) => m.payrollConfigService.getEffective()
        );
        setPayrollConfig(config);
      } catch (error) {
        console.error("Failed to fetch payroll config", error);
      }
    };
    fetchConfig();
  }, [payrollConfig]);

  const selectedDocType = masterData?.idDocumentTypes?.find(
    (t) => t.id === form.watch("idDocumentTypeId")
  );
  const watchIdDocumentTypeId = form.watch("idDocumentTypeId");
  const isIdDocumentOther = React.useMemo(() => {
    if (!masterData?.idDocumentTypes) return false;
    const otherType = masterData.idDocumentTypes.find(
      (t) => (t.code || t.Code || "").toLowerCase() === "other"
    );
    return watchIdDocumentTypeId === (otherType?.id || otherType?.ID);
  }, [watchIdDocumentTypeId, masterData?.idDocumentTypes]);

  useEffect(() => {
    // Only clear if master data is loaded and we know for sure it's not "other"
    if (
      watchIdDocumentTypeId &&
      masterData?.idDocumentTypes &&
      masterData.idDocumentTypes.length > 0 &&
      !isIdDocumentOther
    ) {
      form.setValue("idDocumentOtherDescription", "");
    }
  }, [watchIdDocumentTypeId, isIdDocumentOther, masterData?.idDocumentTypes, form.setValue]);

  useEffect(() => {
    if (masterData?.employeeTypes && employeeTypeId && payrollConfig) {
      const selectedType = masterData.employeeTypes.find(
        (t) => t.id === employeeTypeId
      );

      // Get the name and code (handle both cases)
      const typeCode = (
        selectedType?.code ||
        selectedType?.Code ||
        ""
      ).toLowerCase();
      const typeName = (
        selectedType?.name ||
        selectedType?.Name ||
        ""
      ).toLowerCase();

      // Check if explicitly Part-Time (code 'pt' or name contains 'part', 'พาร์ทไทม์', 'ชั่วคราว')
      const isPartTime =
        typeCode === "pt" ||
        typeName.includes("part") ||
        typeName.includes("พาร์ท") ||
        typeName.includes("ชั่วคราว");

      // Check if explicitly Full-Time (code 'ft' or name contains 'full' or 'ประจำ')
      const isFullTime =
        typeCode === "ft" ||
        typeName.includes("full") ||
        typeName.includes("ประจำ");

      // Detect if employee type changed
      const employeeTypeChanged =
        lastEmployeeTypeRef.current !== employeeTypeId;
      if (employeeTypeChanged) {
        lastEmployeeTypeRef.current = employeeTypeId;
        // Reset auto-fill flag when employee type changes to allow re-fill
        hasAutoFilledHourlyRate.current = false;
      }

      // Detect if ssoContribute was toggled from false to true
      const ssoJustEnabled = ssoContribute && !prevSsoContributeRef.current;
      prevSsoContributeRef.current = ssoContribute;

      // Note: We don't reset ssoDeclaredWage when ssoContribute is unchecked
      // to preserve the value in case user toggles back (e.g., clicked by mistake)

      // Auto-fill SSO Declared Wage using the wage cap from config (for full-time only)
      // Auto-fill when:
      // 1. Creating new employee (!isEditing), OR
      // 2. Employee type just changed (employeeTypeChanged), OR
      // 3. ssoContribute was just toggled from false to true (ssoJustEnabled)
      // AND only when current ssoDeclaredWage is 0 (don't overwrite existing value)
      const currentSsoDeclaredWage = form.getValues("ssoDeclaredWage") || 0;
      if (ssoContribute && isFullTime && (!isEditing || employeeTypeChanged || ssoJustEnabled) && currentSsoDeclaredWage === 0) {
        const currentBasePayAmount = form.getValues("basePayAmount");
        const wageCap = payrollConfig.socialSecurityWageCap || 15000;
        const wage = Math.min(currentBasePayAmount || 0, wageCap);
        form.setValue("ssoDeclaredWage", wage);
      }

      // Auto-fill Hourly Wage for Part-Time when:
      // 1. It's a part-time employee
      // 2. We haven't already auto-filled for this selection
      // 3. Current value is 0 or empty
      if (isPartTime && !hasAutoFilledHourlyRate.current) {
        const currentBasePayAmount = form.getValues("basePayAmount");
        console.log("[EmployeeForm] Part-time detected, checking auto-fill:", {
          isPartTime,
          hasAutoFilledHourlyRate: hasAutoFilledHourlyRate.current,
          currentBasePayAmount,
          hourlyRateFromConfig: payrollConfig.hourlyRate,
          typeCode,
          typeName,
        });
        if (!currentBasePayAmount || currentBasePayAmount === 0) {
          console.log(
            "[EmployeeForm] Setting basePayAmount to:",
            payrollConfig.hourlyRate
          );
          form.setValue("basePayAmount", payrollConfig.hourlyRate);
          hasAutoFilledHourlyRate.current = true;
        }
      }
    }
  }, [ssoContribute, employeeTypeId, masterData, form, payrollConfig]);

  const handleNext = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    const fieldsToValidate: (keyof EmployeeFormValues)[] = [];

    if (activeTab === "personal") {
      fieldsToValidate.push(
        "titleId",
        "firstName",
        "lastName",
        "idDocumentTypeId",
        "idDocumentNumber",
        "idDocumentOtherDescription",
        "phone",
        "email"
      );
    } else if (activeTab === "employment") {
      fieldsToValidate.push(
        "employeeNumber",
        "employeeTypeId",
        "employmentStartDate",
        "employmentEndDate"
      );
    }

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      if (activeTab === "personal") {
        setActiveTab("employment");
        // Small timeout to allow tab switch to render
        setTimeout(() => {
          employmentInputRef.current?.focus();
        }, 100);
      } else if (activeTab === "employment") {
        setActiveTab("financial");
        setTimeout(() => {
          financialInputRef.current?.focus();
        }, 100);
      } else if (activeTab === "financial" && isEditing) {
        setActiveTab("accumulation");
      } else if (activeTab === "accumulation" && isEditing) {
        setActiveTab("documents");
      }
    }
  };

  const handleBack = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (activeTab === "documents") setActiveTab("accumulation");
    else if (activeTab === "accumulation") setActiveTab("financial");
    else if (activeTab === "financial") setActiveTab("employment");
    else if (activeTab === "employment") setActiveTab("personal");
  };

  if (!masterData) {
    return <div>Loading master data...</div>;
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {submitError && (
            <DismissibleAlert
              variant="error"
              title={tCommon("error")}
              onDismiss={() => setSubmitError(null)}
              autoDismiss={false}
            >
              {submitError}
            </DismissibleAlert>
          )}

          {submitSuccess && (
            <DismissibleAlert
              variant="success"
              title={tCommon("success")}
              onDismiss={() => setSubmitSuccess(false)}
              autoDismiss={true}
            >
              {tCommon("saveSuccess")}
            </DismissibleAlert>
          )}

          {/* Dynamic Header Info */}
          <div className="bg-muted/50 p-4 rounded-lg border mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">
                  {t("fields.employeeNumber")}:
                </span>
                <span className="font-medium">{employeeNumber || "-"}</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">
                  {t("fields.firstName")} - {t("fields.lastName")}:
                </span>
                <span className="font-medium">
                  {firstName || "-"} {lastName || ""}{nickname ? ` (${nickname})` : ""}
                </span>
              </div>
              <div className="hidden md:block w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">
                  {t("fields.employeeType")}:
                </span>
                <span className="font-medium">
                  {(() => {
                    const empType = masterData?.employeeTypes?.find(
                      (t) => t.id === employeeTypeId
                    );
                    const typeName = empType?.name || empType?.Name || "";
                    return <EmployeeTypeBadge typeName={typeName} />;
                  })()}
                </span>
              </div>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList
              className={`grid w-full h-auto grid-cols-2 ${
                isEditing ? "md:grid-cols-5" : "md:grid-cols-3"
              }`}
            >
              <TabsTrigger value="personal">{t("personalInfo")}</TabsTrigger>
              <TabsTrigger value="employment">
                {t("employmentInfo")}
              </TabsTrigger>
              <TabsTrigger value="financial">{t("financialInfo")}</TabsTrigger>
              {isEditing && (
                <TabsTrigger value="accumulation">
                  {tAccum("title")}
                </TabsTrigger>
              )}
              {isEditing && (
                <TabsTrigger value="documents">{tDocs("tabTitle")}</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>{t("personalInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Photo Upload Section */}
                  <div className="space-y-2">
                    <Label>{t("fields.photo")}</Label>
                    <div className="flex items-start gap-4">
                      {photoPreview ? (
                        <div className="relative">
                          <img
                            src={photoPreview}
                            alt="Employee Photo"
                            className="h-24 w-24 object-cover border rounded-lg bg-white"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={handleRemovePhoto}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="h-24 w-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          id="photo-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploadingPhoto}
                          onClick={() => photoInputRef.current?.click()}
                        >
                          {uploadingPhoto ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {t("photoUploading")}
                            </>
                          ) : photoPreview ? (
                            t("changePhoto")
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              {t("uploadPhoto")}
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          {t("photoHint")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-4 lg:col-span-2">
                      <FormField
                        control={form.control}
                        name="titleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.title")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("placeholders.selectTitle")}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {masterData.personTitles?.map((item, index) => (
                                  <SelectItem
                                    key={`${item.id}-${index}`}
                                    value={item.id}
                                  >
                                    {item.name ||
                                      item.Name ||
                                      item.code ||
                                      item.Code ||
                                      item.id ||
                                      item.ID ||
                                      "Unknown"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-8 lg:col-span-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.firstName")}</FormLabel>
                            <FormControl>
                              <Input {...field} onFocus={handleFocus} ref={(e) => {
                              field.ref(e);
                              // @ts-ignore
                              personalFirstInputRef.current = e;
                            }} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-6 lg:col-span-3">
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.lastName")}</FormLabel>
                            <FormControl>
                              <Input {...field} onFocus={handleFocus} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-6 lg:col-span-3">
                      <FormField
                        control={form.control}
                        name="nickname"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.nickname")}</FormLabel>
                            <FormControl>
                              <Input {...field} onFocus={handleFocus} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-4 lg:col-span-2">
                      <FormField
                        control={form.control}
                        name="idDocumentTypeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.idCardType")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("placeholders.selectType")}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {masterData.idDocumentTypes?.map(
                                  (item, index) => (
                                    <SelectItem
                                      key={`${item.id}-${index}`}
                                      value={item.id}
                                    >
                                      {item.name ||
                                        item.Name ||
                                        item.code ||
                                        item.Code ||
                                        item.id ||
                                        item.ID ||
                                        "Unknown"}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-8 lg:col-span-4">
                      {isIdDocumentOther && (
                        <FormField
                          control={form.control}
                          name="idDocumentOtherDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("fields.idDocumentOtherDescription")}
                              </FormLabel>
                              <FormControl>
                                <Input {...field} onFocus={handleFocus} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <div className="md:col-span-12 lg:col-span-6">
                      <FormField
                        control={form.control}
                        name="idDocumentNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.idCardNumber")}</FormLabel>
                            <FormControl>
                              <Input {...field} onFocus={handleFocus} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-6 lg:col-start-3 lg:col-span-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.phone")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="tel"
                                onFocus={handleFocus}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-6 lg:col-span-6">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.email")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                onFocus={handleFocus}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="employment">
              <Card>
                <CardHeader>
                  <CardTitle>{t("employmentInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-6 lg:col-span-2">
                      <FormField
                        control={form.control}
                        name="employeeTypeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.employeeType")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("placeholders.selectType")}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {masterData.employeeTypes?.map((item, index) => (
                                  <SelectItem
                                    key={`${item.id}-${index}`}
                                    value={item.id}
                                  >
                                    {item.name ||
                                      item.Name ||
                                      item.code ||
                                      item.Code ||
                                      item.id ||
                                      item.ID ||
                                      "Unknown"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-6 lg:col-span-4">
                      <FormField
                        control={form.control}
                        name="employeeNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.employeeNumber")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                disabled={isEditing}
                                onFocus={handleFocus}
                                ref={(e) => {
                                  field.ref(e);
                                  if (activeTab === "employment") {
                                    // @ts-ignore
                                    employmentInputRef.current = e;
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-6 lg:col-span-2">
                      <FormField
                        control={form.control}
                        name="departmentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.department")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      "placeholders.selectDepartment"
                                    )}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {masterData?.departments?.map((item, index) => (
                                  <SelectItem
                                    key={`${item.id}-${index}`}
                                    value={item.id}
                                  >
                                    {item.name ||
                                      item.Name ||
                                      item.code ||
                                      item.Code ||
                                      "Unknown"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-6 lg:col-span-4">
                      <FormField
                        control={form.control}
                        name="positionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.position")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("placeholders.selectPosition")}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {masterData?.employeePositions?.map(
                                  (item, index) => (
                                    <SelectItem
                                      key={`${item.id}-${index}`}
                                      value={item.id}
                                    >
                                      {item.name ||
                                        item.Name ||
                                        item.code ||
                                        item.Code ||
                                        "Unknown"}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-6 lg:col-span-2">
                      <FormField
                        control={form.control}
                        name="employmentStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.startDate")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="date"
                                onFocus={handleFocus}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-6 lg:col-span-2">
                      <FormField
                        control={form.control}
                        name="employmentEndDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.endDate")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                type="date"
                                onFocus={handleFocus}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial">
              <Card>
                <CardHeader>
                  <CardTitle>{t("financialInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="basePayAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.basePay")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              onFocus={handleFocus}
                              ref={(e) => {
                                field.ref(e);
                                if (activeTab === "financial") {
                                  // @ts-ignore
                                  financialInputRef.current = e;
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.bank")}</FormLabel>
                          <FormControl>
                            <Input {...field} onFocus={handleFocus} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bankAccountNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.accountNo")}</FormLabel>
                          <FormControl>
                            <Input {...field} onFocus={handleFocus} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Social Security & Tax</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="ssoContribute"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{t("fields.sso")}</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ssoDeclaredWage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.ssoWage")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                disabled={!form.watch("ssoContribute")}
                                onFocus={handleFocus}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ssoHospitalName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.ssoHospitalName")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                disabled={!form.watch("ssoContribute")}
                                onFocus={handleFocus}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="withholdTax"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{t("fields.tax")}</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Provident Fund</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="providentFundContribute"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{t("fields.pvd")}</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="providentFundRateEmployee"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.pvdRateEmployee")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                disabled={
                                  !form.watch("providentFundContribute")
                                }
                                onFocus={handleFocus}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="providentFundRateEmployer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("fields.pvdRateEmployer")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                disabled={
                                  !form.watch("providentFundContribute")
                                }
                                onFocus={handleFocus}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">{t("fields.allowances")}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <FormField
                        control={form.control}
                        name="allowHousing"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("fields.housing")}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="allowDoctorFee"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("fields.doctorFee")}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="allowAttendanceBonusNoLate"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("fields.allowAttendanceBonusNoLate")}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="allowAttendanceBonusNoLeave"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("fields.allowAttendanceBonusNoLeave")}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium">{t("fields.utilities")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("fields.utilitiesHint")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="allowWater"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("fields.water")}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="allowElectric"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("fields.electric")}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="allowInternet"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("fields.internet")}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {isEditing && initialData?.id && (
              <TabsContent value="accumulation">
                <AccumulationView employeeId={initialData.id} />
              </TabsContent>
            )}

            {isEditing && initialData?.id && (
              <TabsContent value="documents">
                <DocumentTab employeeId={initialData.id} />
              </TabsContent>
            )}
          </Tabs>

          <div className="flex justify-end space-x-4">
            {activeTab === "personal" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/employees")}
                >
                  {t("cancel")}
                </Button>
                <Button type="button" onClick={handleNext}>
                  {t("next")}
                </Button>
              </>
            ) : activeTab === "employment" ? (
              <>
                <Button type="button" variant="outline" onClick={handleBack}>
                  {t("back")}
                </Button>
                <Button type="button" onClick={handleNext}>
                  {t("next")}
                </Button>
              </>
            ) : activeTab === "financial" && isEditing ? (
              <>
                <Button type="button" variant="outline" onClick={handleBack}>
                  {t("back")}
                </Button>
                <Button type="button" onClick={handleNext}>
                  {t("next")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon("save")}
                </Button>
              </>
            ) : activeTab === "financial" ? (
              <>
                <Button type="button" variant="outline" onClick={handleBack}>
                  {t("back")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon("save")}
                </Button>
              </>
            ) : activeTab === "accumulation" ? (
              <>
                <Button type="button" variant="outline" onClick={handleBack}>
                  {t("back")}
                </Button>
                <Button type="button" onClick={handleNext}>
                  {t("next")}
                </Button>
              </>
            ) : activeTab === "documents" ? (
              <>
                <Button type="button" variant="outline" onClick={handleBack}>
                  {t("back")}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleBack}>
                  {t("back")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon("save")}
                </Button>
              </>
            )}
          </div>
        </form>
      </Form>

      {/* Photo Delete Confirmation Dialog */}
      <AlertDialog
        open={deletePhotoDialogOpen}
        onOpenChange={setDeletePhotoDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("photoDeleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("photoDeleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPhoto} type="button">
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhotoConfirm}
              disabled={deletingPhoto}
              className="bg-destructive hover:bg-destructive/90"
              type="button"
            >
              {deletingPhoto && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
