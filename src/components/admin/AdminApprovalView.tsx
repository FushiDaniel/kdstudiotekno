'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { User } from '@/types';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import { Search, CheckCircle, XCircle, Users, Clock, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { notificationService } from '@/lib/notifications';

export default function AdminApprovalView() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'pending' | 'approved'>('pending');
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    // Listen for pending users (isApproved = false)
    const pendingQuery = query(
      collection(db, 'users'),
      where('isApproved', '==', false)
    );

    const pendingUnsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as User[];
      
      // Filter out admin users from pending list
      const nonAdminUsers = users.filter(u => !u.isAdmin);
      setPendingUsers(nonAdminUsers);
      setLoading(false);
    });

    // Listen for approved users (isApproved = true)
    const approvedQuery = query(
      collection(db, 'users'),
      where('isApproved', '==', true)
    );

    const approvedUnsubscribe = onSnapshot(approvedQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as User[];
      
      // Filter out admin users from approved list
      const nonAdminUsers = users.filter(u => !u.isAdmin);
      setApprovedUsers(nonAdminUsers);
    });

    return () => {
      pendingUnsubscribe();
      approvedUnsubscribe();
    };
  }, []);

  const handleApproveUser = async (userId: string) => {
    setIsUpdating(userId);
    try {
      // Find the user to get their email and name
      const userToApprove = pendingUsers.find(u => u.uid === userId);
      if (!userToApprove) {
        throw new Error('User not found');
      }

      await updateDoc(doc(db, 'users', userId), {
        isApproved: true,
        updatedAt: Timestamp.fromDate(new Date())
      });

      // Send approval email notification
      try {
        await notificationService.notifyAccountApproved(
          userToApprove.email,
          userToApprove.fullname
        );
      } catch (emailError) {
        console.warn('Failed to send approval email:', emailError);
        // Don't fail the approval process if email fails
      }
    } catch (error) {
      console.error('Error approving user:', error);
      alert('Gagal meluluskan pengguna. Sila cuba lagi.');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!confirm('Adakah anda pasti ingin menolak pengguna ini? Tindakan ini tidak boleh dibatalkan.')) {
      return;
    }
    
    setIsUpdating(userId);
    try {
      // Find the user to get their email and name
      const userToReject = pendingUsers.find(u => u.uid === userId);
      if (!userToReject) {
        throw new Error('User not found');
      }

      // For now, we'll just mark them as rejected. In a real app, you might want to delete or mark differently
      await updateDoc(doc(db, 'users', userId), {
        isApproved: false,
        rejectedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });

      // Send rejection email notification
      try {
        await notificationService.notifyAccountRejected(
          userToReject.email,
          userToReject.fullname
        );
      } catch (emailError) {
        console.warn('Failed to send rejection email:', emailError);
        // Don't fail the rejection process if email fails
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('Gagal menolak pengguna. Sila cuba lagi.');
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredUsers = (selectedTab === 'pending' ? pendingUsers : approvedUsers).filter(user => 
    user.fullname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.staffId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin - Kelulusan Pengguna</h1>
        
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari pengguna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2">
          <Button
            variant={selectedTab === 'pending' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('pending')}
          >
            Menunggu Kelulusan ({pendingUsers.length})
          </Button>
          <Button
            variant={selectedTab === 'approved' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('approved')}
          >
            Telah Diluluskan ({approvedUsers.length})
          </Button>
        </div>
      </div>

      {/* User List */}
      <div className="space-y-6">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              {searchTerm ? 
                `Tiada pengguna ditemui untuk "${searchTerm}"` : 
                selectedTab === 'pending' ? 
                  'Tiada pengguna menunggu kelulusan' : 
                  'Tiada pengguna yang diluluskan'
              }
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((userItem) => (
            <UserCard
              key={userItem.uid}
              user={userItem}
              onApprove={() => handleApproveUser(userItem.uid)}
              onReject={() => handleRejectUser(userItem.uid)}
              isUpdating={isUpdating === userItem.uid}
              isPending={selectedTab === 'pending'}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface UserCardProps {
  user: User;
  onApprove: () => void;
  onReject: () => void;
  isUpdating: boolean;
  isPending: boolean;
}

function UserCard({ user, onApprove, onReject, isUpdating, isPending }: UserCardProps) {
  const getEmploymentTypeBadge = (type: string) => {
    switch (type) {
      case 'FT':
        return { text: 'Sepenuh Masa', color: 'bg-green-100 text-green-800' };
      case 'PT':
        return { text: 'Separuh Masa', color: 'bg-blue-100 text-blue-800' };
      case 'FL':
        return { text: 'Bebas', color: 'bg-gray-100 text-gray-800' };
      default:
        return { text: type, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const employmentBadge = getEmploymentTypeBadge(user.employmentType);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.fullname}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <Users className="h-6 w-6 text-gray-500" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900">{user.fullname}</CardTitle>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={employmentBadge.color}>
              {employmentBadge.text}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {user.staffId}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="h-4 w-4 mr-2" />
            {user.phoneNumber || 'Tidak diberikan'}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            {user.homeAddress || 'Tidak diberikan'}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            {formatDate(user.createdAt)}
          </div>
        </div>

        {user.bio && (
          <div className="mb-4">
            <p className="text-sm text-gray-700">{user.bio}</p>
          </div>
        )}

        {user.skills.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Kemahiran:</p>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {user.bankName && user.bankAccountNumber && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-1">Maklumat Bank:</p>
            <p className="text-sm text-gray-600">{user.bankName}</p>
            <p className="text-sm text-gray-600">{user.bankAccountNumber}</p>
          </div>
        )}

        {isPending && (
          <div className="flex space-x-2 pt-4 border-t">
            <Button 
              onClick={onApprove}
              disabled={isUpdating}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isUpdating ? 'Meluluskan...' : 'Luluskan'}
            </Button>
            <Button 
              onClick={onReject}
              disabled={isUpdating}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {isUpdating ? 'Menolak...' : 'Tolak'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}