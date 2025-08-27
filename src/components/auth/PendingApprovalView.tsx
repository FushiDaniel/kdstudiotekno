'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Mail, Phone, CheckCircle, LogOut, Building, CreditCard, User, Save, AlertCircle, XCircle } from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PendingApprovalView() {
  const { user, signOut, updateUser } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    phoneNumber: user?.phoneNumber || '',
    bankName: user?.bankName || '',
    bankAccountNumber: user?.bankAccountNumber || '',
    homeAddress: user?.homeAddress || '',
    bio: user?.bio || ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(!user?.phoneNumber || !user?.bankName || !user?.bankAccountNumber);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isFormValid = () => {
    return formData.phoneNumber.trim() !== '' && 
           formData.bankName.trim() !== '' && 
           formData.bankAccountNumber.trim() !== '';
  };

  const handleSubmitDetails = async () => {
    if (!user || !isFormValid()) return;
    
    setIsSubmitting(true);
    try {
      // Update user profile
      await updateDoc(doc(db, 'users', user.uid), {
        phoneNumber: formData.phoneNumber.trim(),
        bankName: formData.bankName.trim(),
        bankAccountNumber: formData.bankAccountNumber.trim(),
        homeAddress: formData.homeAddress.trim(),
        bio: formData.bio.trim(),
        updatedAt: Timestamp.fromDate(new Date())
      });

      // Update local user state
      await updateUser({
        phoneNumber: formData.phoneNumber.trim(),
        bankName: formData.bankName.trim(),
        bankAccountNumber: formData.bankAccountNumber.trim(),
        homeAddress: formData.homeAddress.trim(),
        bio: formData.bio.trim()
      });

      setHasSubmitted(true);
      setShowForm(false);
    } catch (error) {
      console.error('Error updating user details:', error);
      alert('Gagal mengemas kini maklumat. Sila cuba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user is rejected
  if (user?.isRejected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-900">
              Permohonan Ditolak
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center text-gray-600">
              <p className="text-lg mb-4 text-red-800">
                Maaf, permohonan pendaftaran anda telah ditolak.
              </p>
            </div>

            {/* User Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Maklumat Akaun Anda
              </h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                    {user?.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        alt={user.fullname}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-500 font-semibold">
                        {user?.fullname?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user?.fullname}</p>
                    <p className="text-sm text-gray-500">Staff ID: {user?.staffId}</p>
                  </div>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {user?.email}
                </div>
                
                {user?.phoneNumber && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2" />
                    {user.phoneNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Details */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                <XCircle className="h-5 w-5 mr-2" />
                Sebab Penolakan
              </h3>
              
              {user?.rejectionReason && (
                <div className="mb-4 p-3 bg-white border border-red-100 rounded-lg">
                  <p className="text-sm text-red-800 font-medium mb-1">Sebab:</p>
                  <p className="text-sm text-red-700">{user.rejectionReason}</p>
                </div>
              )}

              {user?.rejectedAt && (
                <div className="mb-4 text-sm text-red-600">
                  <p><strong>Tarikh ditolak:</strong> {new Date(user.rejectedAt).toLocaleDateString('ms-MY')}</p>
                </div>
              )}

              {user?.rejectedByName && (
                <div className="text-sm text-red-600">
                  <p><strong>Ditolak oleh:</strong> {user.rejectedByName} {user?.rejectedByStaffId && `(${user.rejectedByStaffId})`}</p>
                </div>
              )}
            </div>

            {/* Contact Support */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Perlukan Bantuan?
              </h3>
              <div className="space-y-3 text-blue-800">
                <p className="text-sm">
                  Jika anda mempunyai sebarang pertanyaan mengenai penolakan ini atau ingin mengajukan rayuan, sila hubungi admin kami.
                </p>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <a 
                    href="mailto:hubungi@kerisdigital.com" 
                    className="text-blue-600 hover:underline font-medium"
                  >
                    hubungi@kerisdigital.com
                  </a>
                </div>
                <p className="text-xs text-blue-600">
                  Sila sertakan Staff ID anda ({user?.staffId}) dalam email untuk memudahkan proses sokongan.
                </p>
              </div>
            </div>

            {/* Sign Out Button */}
            <div className="text-center pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Log Keluar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Akaun Menunggu Kelulusan
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center text-gray-600">
            <p className="text-lg mb-4">
              Terima kasih kerana mendaftar dengan KDstudio!
            </p>
            <p className="mb-6">
              Akaun anda sedang dalam proses semakan oleh admin kami. Sila lengkapkan maklumat di bawah untuk memudahkan proses kelulusan.
            </p>
          </div>

          {/* User Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Maklumat Akaun Anda
            </h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                  {user?.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt={user.fullname}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-500 font-semibold">
                      {user?.fullname?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.fullname}</p>
                  <p className="text-sm text-gray-500">Staff ID: {user?.staffId}</p>
                </div>
              </div>
              
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="h-4 w-4 mr-2" />
                {user?.email}
              </div>
              
              {user?.phoneNumber && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {user.phoneNumber}
                </div>
              )}
            </div>
          </div>

          {/* Complete Your Details Form */}
          {showForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Lengkapkan Maklumat Anda
              </h3>
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-orange-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium mb-1">Disclaimer *</p>
                    <p>* Kami memerlukan maklumat nombor telefon dan akaun bank untuk tujuan operasi dan pembayaran. Sila pastikan maklumat yang diberikan adalah tepat dan terkini.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-blue-900 mb-1">
                    Nombor Telefon
                  </label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="Contoh: +60123456789"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bankName" className="block text-sm font-medium text-blue-900 mb-1">
                      Nama Bank
                    </label>
                    <Input
                      id="bankName"
                      type="text"
                      placeholder="Contoh: Maybank, CIMB, Public Bank"
                      value={formData.bankName}
                      onChange={(e) => handleInputChange('bankName', e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-blue-900 mb-1">
                      Nombor Akaun Bank
                    </label>
                    <Input
                      id="bankAccountNumber"
                      type="text"
                      placeholder="Nombor akaun bank anda"
                      value={formData.bankAccountNumber}
                      onChange={(e) => handleInputChange('bankAccountNumber', e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="homeAddress" className="block text-sm font-medium text-blue-900 mb-1">
                    Alamat Rumah
                  </label>
                  <textarea
                    id="homeAddress"
                    placeholder="Alamat lengkap rumah anda"
                    value={formData.homeAddress}
                    onChange={(e) => handleInputChange('homeAddress', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    rows={3}
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-blue-900 mb-1">
                    Bio Singkat
                  </label>
                  <textarea
                    id="bio"
                    placeholder="Ceritakan sedikit tentang diri anda dan kemahiran anda"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleSubmitDetails}
                  disabled={!isFormValid() || isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Maklumat'}
                </Button>
              </div>
            </div>
          )}

          {/* Success Message */}
          {hasSubmitted && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900">
                    Maklumat Berjaya Disimpan!
                  </h3>
                  <p className="text-green-800 mt-1">
                    Terima kasih. Maklumat anda telah disimpan dan akan membantu admin dalam proses kelulusan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Show Edit Button if details are already completed */}
          {!showForm && !hasSubmitted && (user?.phoneNumber && user?.bankName && user?.bankAccountNumber) && (
            <div className="text-center">
              <Button 
                variant="outline"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Kemaskini Maklumat
              </Button>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Langkah Seterusnya
            </h3>
            <ul className="space-y-2 text-blue-800">
              <li className="flex items-start">
                <span className="font-semibold mr-2">1.</span>
                <span>Admin akan menyemak maklumat akaun anda</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">2.</span>
                <span>Anda akan menerima notifikasi email apabila akaun diluluskan</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">3.</span>
                <span>Log masuk semula untuk mengakses sistem penuh</span>
              </li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="text-center text-sm text-gray-500">
            <p>
              Jika anda mempunyai sebarang pertanyaan, sila hubungi admin di{' '}
              <a href="mailto:hubungi@kerisdigital.com" className="text-blue-600 hover:underline">
                hubungi@kerisdigital.com
              </a>
            </p>
          </div>

          {/* Sign Out Button */}
          <div className="text-center pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Log Keluar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}