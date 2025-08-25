'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AvailabilityStatus, UserSkill } from '@/types';
import { 
  Mail, 
  Phone, 
  CreditCard, 
  Edit3, 
  Save, 
  X,
  LogOut,
  Settings
} from 'lucide-react';
import Image from 'next/image';
import SkillSelector from './SkillSelector';

export default function ProfileView() {
  const { user, signOut, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [formData, setFormData] = useState({
    fullname: user?.fullname || '',
    phoneNumber: user?.phoneNumber || '',
    homeAddress: user?.homeAddress || '',
    bankName: user?.bankName || '',
    bankAccountNumber: user?.bankAccountNumber || '',
    bio: user?.bio || ''
  });
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (newStatus: AvailabilityStatus) => {
    try {
      await updateUser({ availabilityStatus: newStatus });
      // Force page refresh to ensure state is updated properly
      window.location.reload();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Gagal mengemas kini status. Sila cuba lagi.');
    }
  };

  const getStatusColor = (status: AvailabilityStatus) => {
    switch (status) {
      case AvailabilityStatus.DALAM_TALIAN:
        return 'bg-green-100 text-green-800';
      case AvailabilityStatus.WORKING:
        return 'bg-blue-100 text-blue-800';
      case AvailabilityStatus.BREAK:
        return 'bg-yellow-100 text-yellow-800';
      case AvailabilityStatus.TIDAK_AKTIF:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: AvailabilityStatus) => {
    switch (status) {
      case AvailabilityStatus.DALAM_TALIAN:
        return 'Dalam Talian';
      case AvailabilityStatus.WORKING:
        return 'Sedang Bekerja';
      case AvailabilityStatus.BREAK:
        return 'Rehat';
      case AvailabilityStatus.TIDAK_AKTIF:
        return 'Tidak Aktif';
      default:
        return 'Tidak Diketahui';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      fullname: user?.fullname || '',
      phoneNumber: user?.phoneNumber || '',
      homeAddress: user?.homeAddress || '',
      bankName: user?.bankName || '',
      bankAccountNumber: user?.bankAccountNumber || '',
      bio: user?.bio || ''
    });
    setIsEditing(false);
  };

  const isProfileComplete = () => {
    return user?.fullname && user?.phoneNumber && user?.bankName && user?.bankAccountNumber;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-600">Urus maklumat peribadi dan tetapan akaun anda</p>
      </div>

      {/* Profile Completeness Alert */}
      {!isProfileComplete() && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <Settings className="h-5 w-5 text-orange-600 mr-2" />
              <div>
                <p className="font-medium text-orange-800">Profile Tidak Lengkap</p>
                <p className="text-sm text-orange-600">
                  Sila lengkapkan maklumat profile untuk menggunakan semua fungsi aplikasi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Picture & Basic Info */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-24 h-24 mx-auto mb-4">
                {user?.profileImageUrl ? (
                  <Image
                    src={user.profileImageUrl}
                    alt={user?.fullname || 'Profile'}
                    width={96}
                    height={96}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">
                      {user?.fullname?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {user?.fullname || 'Nama Belum Disetkan'}
              </h2>
              <p className="text-gray-600 mb-2">{user?.staffId}</p>
              <Badge variant="secondary" className="mb-2">
                {user?.employmentType}
              </Badge>
              
              {/* Status Dropdown */}
              <div className="mb-4">
                <label className="block text-xs text-gray-600 mb-1">Status</label>
                <select
                  value={user?.availabilityStatus || AvailabilityStatus.TIDAK_AKTIF}
                  onChange={(e) => handleStatusChange(e.target.value as AvailabilityStatus)}
                  className={`w-full px-3 py-2 rounded-md text-sm font-medium border ${getStatusColor(user?.availabilityStatus || AvailabilityStatus.TIDAK_AKTIF)}`}
                >
                  <option value={AvailabilityStatus.DALAM_TALIAN}>Dalam Talian</option>
                  <option value={AvailabilityStatus.WORKING}>Sedang Bekerja</option>
                  <option value={AvailabilityStatus.BREAK}>Rehat</option>
                  <option value={AvailabilityStatus.TIDAK_AKTIF}>Tidak Aktif</option>
                </select>
              </div>
              
              {/* Notification Settings */}
              <Card className="mb-4">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Notifikasi Tugasan Baru</p>
                      <p className="text-xs text-gray-500">Terima notifikasi untuk tugasan baru sahaja</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={true}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      onChange={(e) => {
                        // This would normally update user preferences in Firebase
                        // For now, just show the UI change
                        console.log('Notification preference:', e.target.checked);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-center">
                  <Mail className="h-4 w-4 mr-2" />
                  {user?.email}
                </div>
                {user?.phoneNumber && (
                  <div className="flex items-center justify-center">
                    <Phone className="h-4 w-4 mr-2" />
                    {user.phoneNumber}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Maklumat Peribadi</CardTitle>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Ubah
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Batal
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Penuh
                </label>
                {isEditing ? (
                  <Input
                    value={formData.fullname}
                    onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                    placeholder="Masukkan nama penuh"
                  />
                ) : (
                  <p className="text-gray-900">{user?.fullname || 'Belum disetkan'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombor Telefon
                </label>
                {isEditing ? (
                  <Input
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="Contoh: +60123456789"
                  />
                ) : (
                  <p className="text-gray-900">{user?.phoneNumber || 'Belum disetkan'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alamat Rumah
                </label>
                {isEditing ? (
                  <Input
                    value={formData.homeAddress}
                    onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                    placeholder="Masukkan alamat rumah"
                  />
                ) : (
                  <p className="text-gray-900">{user?.homeAddress || 'Belum disetkan'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                {isEditing ? (
                  <Input
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Ceritakan sedikit tentang diri anda"
                  />
                ) : (
                  <p className="text-gray-900">{user?.bio || 'Belum disetkan'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bank Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Maklumat Bank
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Bank
                </label>
                {isEditing ? (
                  <Input
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="Contoh: Maybank, CIMB Bank"
                  />
                ) : (
                  <p className="text-gray-900">{user?.bankName || 'Belum disetkan'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombor Akaun Bank
                </label>
                {isEditing ? (
                  <Input
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    placeholder="Masukkan nombor akaun bank"
                  />
                ) : (
                  <p className="text-gray-900">
                    {user?.bankAccountNumber ? 
                      `****${user.bankAccountNumber.slice(-4)}` : 
                      'Belum disetkan'
                    }
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          {user && (
            <SkillSelector 
              user={user}
              onSkillsChange={setUserSkills}
              isEditing={isEditingSkills}
              onToggleEdit={() => setIsEditingSkills(!isEditingSkills)}
            />
          )}

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Tindakan Akaun</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={signOut}
                className="w-full sm:w-auto"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Keluar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}