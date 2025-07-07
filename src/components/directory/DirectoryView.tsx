'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User } from '@/types';
import { collection, query, onSnapshot, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { Search, Users, Phone, Mail, MapPin, X, Building, CreditCard, UserCheck, CheckCircle, XCircle, Clock } from 'lucide-react';
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

export default function DirectoryView() {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'approved'>('directory');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    // Listen for all users (for directory)
    const allUsersQuery = query(collection(db, 'users'));
    const allUsersUnsubscribe = onSnapshot(allUsersQuery, async (snapshot) => {
      const allUsers = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        let profileImageUrl = data.profileImageUrl;
        
        // If no profile image URL exists, try to fetch from storage
        if (!profileImageUrl) {
          try {
            const imageRef = ref(storage, `users/${doc.id}/profile.jpg`);
            profileImageUrl = await getDownloadURL(imageRef);
          } catch {
            console.log('No profile image found for user:', doc.id);
          }
        }

        return {
          uid: doc.id,
          ...data,
          profileImageUrl,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      })) as User[];
      
      setUsers(allUsers);
      setLoading(false);
    });

    // Listen for pending users (only for admins)
    let pendingUnsubscribe = () => {};
    let approvedUnsubscribe = () => {};
    
    if (currentUser?.isAdmin) {
      const pendingQuery = query(
        collection(db, 'users'),
        where('isApproved', '==', false)
      );
      pendingUnsubscribe = onSnapshot(pendingQuery, (snapshot) => {
        const users = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        })) as User[];
        
        const nonAdminUsers = users.filter(u => !u.isAdmin);
        setPendingUsers(nonAdminUsers);
      });

      const approvedQuery = query(
        collection(db, 'users'),
        where('isApproved', '==', true)
      );
      approvedUnsubscribe = onSnapshot(approvedQuery, (snapshot) => {
        const users = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        })) as User[];
        
        const nonAdminUsers = users.filter(u => !u.isAdmin);
        setApprovedUsers(nonAdminUsers);
      });
    }

    return () => {
      allUsersUnsubscribe();
      pendingUnsubscribe();
      approvedUnsubscribe();
    };
  }, [currentUser?.isAdmin]);

  const handleApproveUser = async (userId: string) => {
    setIsUpdating(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        isApproved: true,
        updatedAt: Timestamp.fromDate(new Date())
      });
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
      await updateDoc(doc(db, 'users', userId), {
        isApproved: false,
        rejectedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('Gagal menolak pengguna. Sila cuba lagi.');
    } finally {
      setIsUpdating(null);
    }
  };

  const getCurrentUsers = () => {
    switch (activeTab) {
      case 'directory':
        return users;
      case 'pending':
        return pendingUsers;
      case 'approved':
        return approvedUsers;
      default:
        return users;
    }
  };

  const filteredUsers = getCurrentUsers().filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.fullname?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.staffId?.toLowerCase().includes(searchLower) ||
      user.skills?.some(skill => skill.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {activeTab === 'directory' ? 'Directory Staf' : 
           activeTab === 'pending' ? 'Kelulusan Pengguna' : 
           'Pengguna Diluluskan'}
        </h1>
        <p className="text-gray-600">
          {activeTab === 'directory' ? 'Direktori ahli pasukan KDStudio' : 
           activeTab === 'pending' ? 'Pengguna menunggu kelulusan' : 
           'Pengguna yang telah diluluskan'}
        </p>
      </div>

      {/* Tab Navigation - Show only for admins */}
      {currentUser?.isAdmin && (
        <div className="mb-6">
          <div className="flex space-x-2">
            <Button
              variant={activeTab === 'directory' ? 'default' : 'outline'}
              onClick={() => setActiveTab('directory')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Directory ({users.length})
            </Button>
            <Button
              variant={activeTab === 'pending' ? 'default' : 'outline'}
              onClick={() => setActiveTab('pending')}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Menunggu ({pendingUsers.length})
            </Button>
            <Button
              variant={activeTab === 'approved' ? 'default' : 'outline'}
              onClick={() => setActiveTab('approved')}
              className="flex items-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Diluluskan ({approvedUsers.length})
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari nama, email, ID staf, atau kemahiran..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats - Only show for directory tab */}
      {activeTab === 'directory' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Jumlah Staf</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Dlm Talian</p>
                  <p className="text-2xl font-bold">
                    {users.filter(u => u.availabilityStatus === 'dalam_talian').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Tdk Aktif</p>
                  <p className="text-2xl font-bold">
                    {users.filter(u => u.availabilityStatus === 'tidak_aktif').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Grid */}
      <div className={activeTab === 'directory' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-6"}>
        {filteredUsers.length === 0 ? (
          <div className={activeTab === 'directory' ? "col-span-full text-center py-8" : "text-center py-8"}>
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">
              {searchTerm ? `Tiada hasil untuk "${searchTerm}"` : 
               activeTab === 'directory' ? 'Tiada staf dalam direktori' :
               activeTab === 'pending' ? 'Tiada pengguna menunggu kelulusan' :
               'Tiada pengguna yang diluluskan'}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            activeTab === 'directory' ? (
              <UserCard 
                key={user.uid} 
                user={user} 
                onClick={() => setSelectedUser(user)}
                showDetails={currentUser?.isAdmin || false}
              />
            ) : (
              <ApprovalUserCard
                key={user.uid}
                user={user}
                onApprove={() => handleApproveUser(user.uid)}
                onReject={() => handleRejectUser(user.uid)}
                isUpdating={isUpdating === user.uid}
                isPending={activeTab === 'pending'}
              />
            )
          ))
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">Maklumat Staf</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="flex items-start space-x-6">
                {/* Profile Image */}
                <div className="relative">
                  {selectedUser.profileImageUrl ? (
                    <img 
                      src={selectedUser.profileImageUrl} 
                      alt={selectedUser.fullname}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center">
                      <span className="text-2xl text-white font-bold">
                        {selectedUser.fullname?.charAt(0) || 'U'}
                      </span>
                    </div>
                  )}
                  <Badge 
                    className={`absolute -bottom-2 right-0 ${
                      getStatusColor(selectedUser.availabilityStatus)
                    }`}
                  >
                    {getStatusText(selectedUser.availabilityStatus)}
                  </Badge>
                </div>

                {/* Basic Info */}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedUser.fullname}
                  </h3>
                  <p className="text-gray-600">{selectedUser.staffId}</p>
                  {selectedUser.isAdmin && (
                    <Badge className="mt-2 bg-purple-100 text-purple-800">
                      Admin
                    </Badge>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="mt-6 space-y-4">
                <h4 className="font-medium text-gray-900">Maklumat Hubungan</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedUser.email && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>{selectedUser.email}</span>
                    </div>
                  )}
                  {selectedUser.phoneNumber && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{selectedUser.phoneNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Skills */}
              {selectedUser.skills && selectedUser.skills.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Kemahiran</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Only Section */}
              {currentUser?.isAdmin && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium text-gray-900 mb-4">Maklumat Sulit (Admin Sahaja)</h4>
                  <div className="space-y-4">
                    {selectedUser.homeAddress && (
                      <div className="flex items-start space-x-2 text-gray-600">
                        <MapPin className="h-4 w-4 mt-1" />
                        <span>{selectedUser.homeAddress}</span>
                      </div>
                    )}
                    {selectedUser.bankName && (
                      <div className="flex items-start space-x-2 text-gray-600">
                        <Building className="h-4 w-4 mt-1" />
                        <span>{selectedUser.bankName}</span>
                      </div>
                    )}
                    {selectedUser.bankAccountNumber && (
                      <div className="flex items-start space-x-2 text-gray-600">
                        <CreditCard className="h-4 w-4 mt-1" />
                        <span>{selectedUser.bankAccountNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface UserCardProps {
  user: User;
  onClick: () => void;
  showDetails: boolean;
}

function UserCard({ user, onClick, showDetails }: UserCardProps) {
  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer" 
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {/* Profile Image */}
          <div className="relative">
            {user.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt={user.fullname}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">
                  {user.fullname?.charAt(0) || 'U'}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900 truncate">
                  {user.fullname || 'Nama Tidak Disetkan'}
                </h3>
                <p className="text-sm text-gray-600">{user.staffId}</p>
              </div>
              <Badge className={getStatusColor(user.availabilityStatus)}>
                {getStatusText(user.availabilityStatus)}
              </Badge>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              {user.email && (
                <div className="flex items-center">
                  <Mail className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
              
              {user.phoneNumber && (
                <div className="flex items-center">
                  <Phone className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span>{user.phoneNumber}</span>
                </div>
              )}
              
              {showDetails && user.homeAddress && (
                <div className="flex items-center">
                  <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span className="truncate">{user.homeAddress}</span>
                </div>
              )}
            </div>

            {user.skills && user.skills.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1">
                  {user.skills.slice(0, 3).map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {user.skills.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{user.skills.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {user.isAdmin && (
              <div className="mt-2">
                <Badge className="bg-purple-100 text-purple-800">
                  Admin
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ApprovalUserCardProps {
  user: User;
  onApprove: () => void;
  onReject: () => void;
  isUpdating: boolean;
  isPending: boolean;
}

function ApprovalUserCard({ user, onApprove, onReject, isUpdating, isPending }: ApprovalUserCardProps) {
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

        {user.skills && user.skills.length > 0 && (
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