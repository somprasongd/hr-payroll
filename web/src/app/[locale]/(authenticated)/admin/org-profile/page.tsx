'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { orgProfileService, type OrgProfile, type CreateOrgProfileRequest } from '@/services/org-profile.service';
import { ApiError } from '@/lib/api-client';
import { 
  Save, 
  History, 
  AlertCircle,
  Loader2,
  CheckCircle,
  Info,
  Upload,
  X,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface OrgProfileFormData {
  startDate: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  phoneMain: string;
  phoneAlt: string;
  email: string;
  taxId: string;
  slipFooterNote: string;
  logoId: string;
}

export default function OrgProfilePage() {
  const t = useTranslations('OrgProfile');
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeProfile, setActiveProfile] = useState<OrgProfile | null>(null);
  const [profileHistory, setProfileHistory] = useState<OrgProfile[]>([]);
  const [formData, setFormData] = useState<OrgProfileFormData>({
    startDate: new Date().toISOString().split('T')[0],
    companyName: '',
    addressLine1: '',
    addressLine2: '',
    subdistrict: '',
    district: '',
    province: '',
    postalCode: '',
    phoneMain: '',
    phoneAlt: '',
    email: '',
    taxId: '',
    slipFooterNote: '',
    logoId: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('company');
  
  // Logo states
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleNext = () => {
    if (activeTab === 'company') setActiveTab('address');
    else if (activeTab === 'address') setActiveTab('contact');
    else if (activeTab === 'contact') setActiveTab('slip');
  };

  const handleBack = () => {
    if (activeTab === 'address') setActiveTab('company');
    else if (activeTab === 'contact') setActiveTab('address');
    else if (activeTab === 'slip') setActiveTab('contact');
  };

  // Fetch effective profile
  const fetchEffectiveProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await orgProfileService.getEffective();
      setActiveProfile(profile);
      // Populate form with current data
      setFormData({
        startDate: profile.startDate || new Date().toISOString().split('T')[0],
        companyName: profile.companyName || '',
        addressLine1: profile.addressLine1 || '',
        addressLine2: profile.addressLine2 || '',
        subdistrict: profile.subdistrict || '',
        district: profile.district || '',
        province: profile.province || '',
        postalCode: profile.postalCode || '',
        phoneMain: profile.phoneMain || '',
        phoneAlt: profile.phoneAlt || '',
        email: profile.email || '',
        taxId: profile.taxId || '',
        slipFooterNote: profile.slipFooterNote || '',
        logoId: profile.logoId || '',
      });
      // Load logo preview if exists
      if (profile.logoId) {
        const logoUrl = await orgProfileService.fetchLogoWithCache(profile.logoId);
        setLogoPreview(logoUrl);
      }
    } catch (err) {
      const apiError = err as ApiError;
      // 404 means no profile exists yet, which is OK
      if (apiError.statusCode !== 404) {
        setError(apiError.message || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch profile history
  const fetchProfileHistory = async () => {
    try {
      const response = await orgProfileService.getAll({ limit: 50 });
      setProfileHistory(response.data || []);
    } catch (err) {
      console.error('Failed to fetch profile history:', err);
    }
  };

  useEffect(() => {
    fetchEffectiveProfile();
    fetchProfileHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (field: keyof OrgProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear messages on change
    setError(null);
    setSuccess(null);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.select();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError(t('logoUploadError') + ' (max 2MB)');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('logoUploadError') + ' (image only)');
      return;
    }

    setUploadingLogo(true);
    setError(null);

    try {
      const response = await orgProfileService.uploadLogo(file);
      setFormData(prev => ({ ...prev, logoId: response.id }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      setSuccess(t('logoUploadSuccess'));
    } catch (err) {
      const apiError = err as Error;
      setError(apiError.message || t('logoUploadError'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logoId: '' }));
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (activeProfile) {
      setFormData({
        startDate: new Date().toISOString().split('T')[0],
        companyName: activeProfile.companyName || '',
        addressLine1: activeProfile.addressLine1 || '',
        addressLine2: activeProfile.addressLine2 || '',
        subdistrict: activeProfile.subdistrict || '',
        district: activeProfile.district || '',
        province: activeProfile.province || '',
        postalCode: activeProfile.postalCode || '',
        phoneMain: activeProfile.phoneMain || '',
        phoneAlt: activeProfile.phoneAlt || '',
        email: activeProfile.email || '',
        taxId: activeProfile.taxId || '',
        slipFooterNote: activeProfile.slipFooterNote || '',
        logoId: activeProfile.logoId || '',
      });
      // Reset logo preview
      if (activeProfile.logoId) {
        orgProfileService.fetchLogoWithCache(activeProfile.logoId).then(setLogoPreview);
      } else {
        setLogoPreview(null);
      }
    }
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.companyName.trim()) {
      setError(t('companyName') + ' is required');
      setActiveTab('company');
      return;
    }
    if (!formData.startDate) {
      setError(t('effectiveDate') + ' is required');
      setActiveTab('company');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const requestData: CreateOrgProfileRequest = {
        startDate: formData.startDate,
        companyName: formData.companyName,
        addressLine1: formData.addressLine1 || undefined,
        addressLine2: formData.addressLine2 || undefined,
        subdistrict: formData.subdistrict || undefined,
        district: formData.district || undefined,
        province: formData.province || undefined,
        postalCode: formData.postalCode || undefined,
        phoneMain: formData.phoneMain || undefined,
        phoneAlt: formData.phoneAlt || undefined,
        email: formData.email || undefined,
        taxId: formData.taxId || undefined,
        slipFooterNote: formData.slipFooterNote || undefined,
        logoId: formData.logoId || undefined,
      };

      await orgProfileService.create(requestData);
      setSuccess(t('saveSuccess'));
      
      // Refresh data
      await fetchEffectiveProfile();
      await fetchProfileHistory();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={() => fetchProfileHistory()}>
              <History className="h-4 w-4 mr-2" />
              {t('viewHistory')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('configurationHistory')}</DialogTitle>
              <DialogDescription>{t('historyDescription')}</DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('version')}</TableHead>
                  <TableHead>{t('companyName')}</TableHead>
                  <TableHead>{t('startDate')}</TableHead>
                  <TableHead>{t('endDate')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profileHistory.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-mono">v{profile.versionNo}</TableCell>
                    <TableCell>{profile.companyName}</TableCell>
                    <TableCell>{profile.startDate}</TableCell>
                    <TableCell>{profile.endDate || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={profile.status === 'active' ? 'default' : 'secondary'}>
                        {profile.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {profileHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No history available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current config info */}
      {activeProfile && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('currentConfig')}</AlertTitle>
          <AlertDescription>
            {t('currentConfigDescription', { 
              version: activeProfile.versionNo, 
              startDate: activeProfile.startDate 
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Error/Success alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">{t('success')}</AlertTitle>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="company">{t('companyInfo')}</TabsTrigger>
          <TabsTrigger value="address">{t('addressInfo')}</TabsTrigger>
          <TabsTrigger value="contact">{t('contactInfo')}</TabsTrigger>
          <TabsTrigger value="slip">{t('slipSettings')}</TabsTrigger>
        </TabsList>

        {/* Company Info Tab */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('companyInfo')}</CardTitle>
              <CardDescription>{t('companyInfoDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t('effectiveDate')}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    ref={firstFieldRef}
                  />
                  <p className="text-xs text-muted-foreground">{t('effectiveDateHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">{t('companyName')} *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder={t('companyNameHint')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">{t('taxId')}</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => handleInputChange('taxId', e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder={t('taxIdHint')}
                  maxLength={13}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address Tab */}
        <TabsContent value="address" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('addressInfo')}</CardTitle>
              <CardDescription>{t('addressInfoDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">{t('addressLine1')}</Label>
                <Input
                  id="addressLine1"
                  value={formData.addressLine1}
                  onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder={t('addressLine1Hint')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">{t('addressLine2')}</Label>
                <Input
                  id="addressLine2"
                  value={formData.addressLine2}
                  onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder={t('addressLine2Hint')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="subdistrict">{t('subdistrict')}</Label>
                  <Input
                    id="subdistrict"
                    value={formData.subdistrict}
                    onChange={(e) => handleInputChange('subdistrict', e.target.value)}
                    onFocus={handleInputFocus}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">{t('district')}</Label>
                  <Input
                    id="district"
                    value={formData.district}
                    onChange={(e) => handleInputChange('district', e.target.value)}
                    onFocus={handleInputFocus}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="province">{t('province')}</Label>
                  <Input
                    id="province"
                    value={formData.province}
                    onChange={(e) => handleInputChange('province', e.target.value)}
                    onFocus={handleInputFocus}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">{t('postalCode')}</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                    onFocus={handleInputFocus}
                    maxLength={5}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('contactInfo')}</CardTitle>
              <CardDescription>{t('contactInfoDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phoneMain">{t('phoneMain')}</Label>
                  <Input
                    id="phoneMain"
                    value={formData.phoneMain}
                    onChange={(e) => handleInputChange('phoneMain', e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder={t('phoneMainHint')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneAlt">{t('phoneAlt')}</Label>
                  <Input
                    id="phoneAlt"
                    value={formData.phoneAlt}
                    onChange={(e) => handleInputChange('phoneAlt', e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder={t('phoneAltHint')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder={t('emailHint')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slip Settings Tab */}
        <TabsContent value="slip" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('slipSettings')}</CardTitle>
              <CardDescription>{t('slipSettingsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="slipFooterNote">{t('slipFooterNote')}</Label>
                <Textarea
                  id="slipFooterNote"
                  value={formData.slipFooterNote}
                  onChange={(e) => handleInputChange('slipFooterNote', e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder={t('slipFooterNoteHint')}
                  rows={3}
                />
              </div>
              
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>{t('logo')}</Label>
                <div className="flex items-start gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img 
                        src={logoPreview} 
                        alt="Company Logo" 
                        className="h-24 w-24 object-contain border rounded-lg bg-white"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={handleRemoveLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-24 w-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('logoUploading')}
                        </>
                      ) : logoPreview ? (
                        t('changeLogo')
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {t('uploadLogo')}
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">{t('logoHint')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Navigation buttons */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
        >
          {t('reset')}
        </Button>
        <div className="flex gap-2">
          {activeTab !== 'company' && (
            <Button variant="outline" onClick={handleBack} disabled={saving}>
              {t('back')}
            </Button>
          )}
          {activeTab !== 'slip' ? (
            <Button onClick={handleNext} disabled={saving}>
              {t('next')}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('saveChanges')}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
