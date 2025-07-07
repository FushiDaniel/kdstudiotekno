'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Mail, Phone, CheckCircle, LogOut } from 'lucide-react';

export default function PendingApprovalView() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
              Akaun anda sedang dalam proses semakan oleh admin kami. Anda akan menerima akses penuh ke sistem selepas akaun anda diluluskan.
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