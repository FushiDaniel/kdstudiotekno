'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, AlertTriangle } from 'lucide-react';
import { User } from '@/types';

interface RejectUserDialogProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isProcessing: boolean;
}

const COMMON_REJECTION_REASONS = [
  'Maklumat tidak lengkap atau tidak tepat',
  'Dokumen yang diperlukan tidak disediakan',
  'Tidak memenuhi syarat kelayakan minimum',
  'Maklumat bank tidak sah atau tidak boleh disahkan',
  'Nombor telefon tidak aktif atau tidak sah',
  'Alamat email tidak sah atau tidak boleh dihubungi',
  'Kemahiran yang dinyatakan tidak berkaitan dengan keperluan syarikat',
  'Permohonan berganda (duplicate application)',
  'Maklumat peribadi tidak konsisten',
  'Lain-lain'
];

export default function RejectUserDialog({ user, isOpen, onClose, onConfirm, isProcessing }: RejectUserDialogProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const finalReason = selectedReason === 'Lain-lain' ? customReason : selectedReason;
    if (finalReason.trim()) {
      onConfirm(finalReason.trim());
    }
  };

  const isFormValid = () => {
    if (selectedReason === 'Lain-lain') {
      return customReason.trim().length > 0;
    }
    return selectedReason.length > 0;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-xl font-semibold text-red-900">
                Tolak Permohonan Pengguna
              </CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={isProcessing}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Pengguna yang akan ditolak:</h3>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt={user.fullname}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-gray-500 font-semibold text-sm">
                    {user.fullname?.charAt(0)?.toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{user.fullname}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
                <p className="text-xs text-gray-500">Staff ID: {user.staffId}</p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium mb-1">Amaran</p>
                <p>Tindakan ini akan menolak permohonan pengguna secara kekal. Pengguna akan menerima notifikasi email dengan sebab penolakan. Tindakan ini tidak boleh dibatalkan.</p>
              </div>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Pilih sebab penolakan:
            </label>
            <div className="space-y-2">
              {COMMON_REJECTION_REASONS.map((reason) => (
                <label key={reason} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="rejection-reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-1 flex-shrink-0"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Reason Input */}
          {selectedReason === 'Lain-lain' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Nyatakan sebab penolakan:
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Sila nyatakan sebab penolakan dengan jelas..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-sm"
                rows={4}
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 10 aksara diperlukan untuk sebab kustom.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!isFormValid() || isProcessing || (selectedReason === 'Lain-lain' && customReason.trim().length < 10)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isProcessing ? 'Menolak...' : 'Tolak Permohonan'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}