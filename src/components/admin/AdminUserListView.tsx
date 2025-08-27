'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User } from '@/types';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Users, Phone, Mail, MapPin, Clock, Building, CreditCard, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'working':
      return 'bg-blue-100 text-blue-800';
    case 'break':
      return 'bg-yellow-100 text-yellow-800';
    case 'idle':
      return 'bg-gray-100 text-gray-800';
    case 'dalam_talian':
      return 'bg-green-100 text-green-800';
    case 'tidak_aktif':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'working':
      return 'Sdg Bekerja';
    case 'break':
      return 'Rehat';
    case 'idle':
      return 'Idle';
    case 'dalam_talian':
      return 'Dlm Talian';
    case 'tidak_aktif':
      return 'Tidak Aktif';
    default:
      return 'Tdk Diketahui';
  }
};

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

export default function AdminUserListView() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser?.isAdmin) return;

    // Listen for all users
    const allUsersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(allUsersQuery, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as User[];
      
      setUsers(allUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.isAdmin]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filteredUsers = users
    .filter(user => {
      const searchLower = searchTerm.toLowerCase();
      return (
        user.fullname?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.staffId?.toLowerCase().includes(searchLower) ||
        user.uid?.toLowerCase().includes(searchLower) ||
        user.phoneNumber?.toLowerCase().includes(searchLower) ||
        user.bankAccountNumber?.toLowerCase().includes(searchLower) ||
        user.homeAddress?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      // Admin users first
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      // Then by approval status
      if (a.isApproved && !b.isApproved) return -1;
      if (!a.isApproved && b.isApproved) return 1;
      // Then by date created
      return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    });

  if (!currentUser?.isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Akses Tidak Dibenarkan</h1>
          <p className="text-gray-600">Anda tidak mempunyai kebenaran untuk melihat halaman ini.</p>
        </div>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Senarai Pengguna (Admin)</h1>
        <p className="text-gray-600 mb-6">Senarai lengkap semua pengguna dalam sistem dengan maklumat terperinci.</p>
        
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari pengguna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Jumlah Pengguna</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Admin</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.isAdmin).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Diluluskan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.isApproved).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center mr-3">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Belum Diluluskan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => !u.isApproved && !u.isAdmin).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              {searchTerm ? 
                `Tiada pengguna ditemui untuk "${searchTerm}"` : 
                'Tiada pengguna dalam sistem'
              }
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <UserDetailCard key={user.uid} user={user} onCopy={copyToClipboard} />
          ))
        )}
      </div>
    </div>
  );
}

interface UserDetailCardProps {
  user: User;
  onCopy: (text: string) => void;
}

function UserDetailCard({ user, onCopy }: UserDetailCardProps) {
  const employmentBadge = getEmploymentTypeBadge(user.employmentType);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
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
          
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <CardTitle className="text-lg text-gray-900">{user.fullname}</CardTitle>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">
                {user.staffId}
              </Badge>
              <Badge className={employmentBadge.color}>
                {employmentBadge.text}
              </Badge>
              <Badge className={getStatusColor(user.availabilityStatus)}>
                {getStatusText(user.availabilityStatus)}
              </Badge>
              {user.isAdmin && (
                <Badge className="bg-purple-100 text-purple-800 text-xs">
                  Admin
                </Badge>
              )}
              {!user.isApproved && !user.isAdmin && (
                <Badge variant="destructive" className="text-xs">
                  Belum Diluluskan
                </Badge>
              )}
              {user.isApproved && (
                <Badge className="bg-green-100 text-green-800 text-xs">
                  Diluluskan
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* System Information */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">Maklumat Sistem</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Document ID:</span>
              <div className="flex items-center space-x-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                  {user.uid}
                </code>
                <button
                  onClick={() => onCopy(user.uid)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-2" />
              Dibuat: {formatDate(user.createdAt)}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="h-4 w-4 mr-2" />
            {user.phoneNumber || 'Tidak diberikan'}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Mail className="h-4 w-4 mr-2" />
            <div className="flex items-center space-x-2">
              <span>{user.email}</span>
              <button
                onClick={() => onCopy(user.email)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Address */}
        {user.homeAddress && (
          <div className="mb-4">
            <div className="flex items-start text-sm text-gray-600">
              <MapPin className="h-4 w-4 mr-2 mt-1" />
              <div className="flex-1">
                <span>{user.homeAddress}</span>
                <button
                  onClick={() => onCopy(user.homeAddress)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bio */}
        {user.bio && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Bio</h4>
            <p className="text-sm text-gray-600">{user.bio}</p>
          </div>
        )}

        {/* Skills */}
        {user.skills && user.skills.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Kemahiran</h4>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Banking Information */}
        {(user.bankName || user.bankAccountNumber) && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Maklumat Bank</h4>
            <div className="space-y-2">
              {user.bankName && (
                <div className="flex items-center text-sm text-gray-600">
                  <Building className="h-4 w-4 mr-2" />
                  <span>{user.bankName}</span>
                </div>
              )}
              {user.bankAccountNumber && (
                <div className="flex items-center text-sm text-gray-600">
                  <CreditCard className="h-4 w-4 mr-2" />
                  <div className="flex items-center space-x-2">
                    <span>{user.bankAccountNumber}</span>
                    <button
                      onClick={() => onCopy(user.bankAccountNumber)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}