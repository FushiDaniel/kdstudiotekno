'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export default function ProfileView() {
  const { user, signOut, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullname: user?.fullname || '',
    phoneNumber: user?.phoneNumber || '',
    homeAddress: user?.homeAddress || '',
    bankName: user?.bankName || '',
    bankAccountNumber: user?.bankAccountNumber || '',
    bio: user?.bio || ''
  });
  const [saving, setSaving] = useState(false);

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
                {user?.photoURL ? (
                  <Image
                    src={user.photoURL}
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
              <Badge variant="secondary" className="mb-4">
                {user?.employmentType}
              </Badge>
              
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
                  Edit
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
          <Card>
            <CardHeader>
              <CardTitle>Kemahiran</CardTitle>
            </CardHeader>
            <CardContent>
              {user?.skills && user.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Tiada kemahiran disetkan</p>
              )}
            </CardContent>
          </Card>

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