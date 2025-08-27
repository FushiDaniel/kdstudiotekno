'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, UserSkill } from '@/types';
import { collection, query, onSnapshot, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { Search, Users, Phone, Mail, MapPin, X, Building, CreditCard, UserCheck, CheckCircle, XCircle, Clock, Award, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';
import SkillManagement from '@/components/admin/SkillManagement';
import AdminUserListView from '@/components/admin/AdminUserListView';

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
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'approved' | 'manage-skills' | 'admin-users'>('directory');
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

    // Listen for pending users (for admins and part-time users)
    let pendingUnsubscribe = () => {};
    let approvedUnsubscribe = () => {};
    
    if (currentUser?.isAdmin || currentUser?.staffId?.startsWith('PT')) {
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

    // Listen for user skills
    const userSkillsQuery = query(collection(db, 'userSkills'));
    const userSkillsUnsubscribe = onSnapshot(userSkillsQuery, (snapshot) => {
      const skills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        assignedAt: doc.data().assignedAt?.toDate() || new Date(),
        verifiedAt: doc.data().verifiedAt?.toDate()
      })) as UserSkill[];
      setUserSkills(skills);
    });

    return () => {
      allUsersUnsubscribe();
      pendingUnsubscribe();
      approvedUnsubscribe();
      userSkillsUnsubscribe();
    };
  }, [currentUser?.isAdmin, currentUser?.staffId]);

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

  const handleVerifySkill = async (userSkillId: string, verified: boolean) => {
    if (!currentUser) return;

    setIsUpdating(userSkillId);
    try {
      const updateData: any = {
        verified,
        updatedAt: Timestamp.fromDate(new Date())
      };

      if (verified) {
        updateData.verifiedBy = currentUser.uid;
        updateData.verifiedByName = currentUser.fullname;
        updateData.verifiedAt = Timestamp.fromDate(new Date());
      } else {
        updateData.verifiedBy = null;
        updateData.verifiedByName = null;
        updateData.verifiedAt = null;
      }

      await updateDoc(doc(db, 'userSkills', userSkillId), updateData);
    } catch (error) {
      console.error('Error updating skill verification:', error);
      alert('Gagal mengemas kini pengesahan kemahiran. Sila cuba lagi.');
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

  const getUserSkills = (userId: string) => {
    return userSkills.filter(skill => skill.userId === userId);
  };

  const filteredUsers = getCurrentUsers()
    .filter(user => {
      const searchLower = searchTerm.toLowerCase();
      return (
        user.fullname?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.staffId?.toLowerCase().includes(searchLower) ||
        user.skills?.some(skill => skill.toLowerCase().includes(searchLower))
      );
    })
    .sort((a, b) => {
      // Admin users first
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      // Then sort by date added (createdAt)
      return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    });

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
      {activeTab !== 'manage-skills' && activeTab !== 'admin-users' && (
        <div className="text-center mb-12">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {activeTab === 'directory' ? 'Direktori Staf' : 
               activeTab === 'pending' ? 'Permohonan Keahlian' : 
               'Ahli Diluluskan'}
            </h1>
            <p className="text-lg text-gray-600">
              {activeTab === 'directory' ? 'Senarai ahli pasukan KDStudio' : 
               activeTab === 'pending' ? 'Senarai permohonan yang menunggu kelulusan' : 
               'Senarai ahli yang telah diluluskan'}
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation - Show for admins and part-time users (PT prefix) */}
      {(currentUser?.isAdmin || currentUser?.staffId?.startsWith('PT')) && (
        <div className="mb-6">
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 min-w-0 flex items-center gap-1 ${
                activeTab === 'directory'
                  ? 'bg-gray-800 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Dir</span>
              <span className="hidden sm:inline">Direktori ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 min-w-0 flex items-center gap-1 ${
                activeTab === 'pending'
                  ? 'bg-gray-800 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Tunggu</span>
              <span className="hidden sm:inline">Permohonan ({pendingUsers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 min-w-0 flex items-center gap-1 ${
                activeTab === 'approved'
                  ? 'bg-gray-800 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Lulus</span>
              <span className="hidden sm:inline">Diluluskan ({approvedUsers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('manage-skills')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 min-w-0 flex items-center gap-1 ${
                activeTab === 'manage-skills'
                  ? 'bg-gray-800 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Award className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Skill</span>
              <span className="hidden sm:inline">Kemahiran</span>
            </button>
            {currentUser?.isAdmin && (
              <button
                onClick={() => setActiveTab('admin-users')}
                className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 min-w-0 flex items-center gap-1 ${
                  activeTab === 'admin-users'
                    ? 'bg-gray-800 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="sm:hidden">Admin</span>
                <span className="hidden sm:inline">Semua Pengguna</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      {activeTab !== 'manage-skills' && activeTab !== 'admin-users' && (
        <div className="mb-6">
          <div className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari mengikut nama, emel, ID staf atau kemahiran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats - Only show for directory tab */}
      {activeTab === 'directory' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border border-gray-200 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Bilangan Staf</p>
                  <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Dalam Talian</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter(u => u.availabilityStatus === 'dalam_talian').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mr-3">
                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Tidak Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter(u => u.availabilityStatus === 'tidak_aktif').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Grid */}
      {activeTab !== 'manage-skills' && activeTab !== 'admin-users' && (
        <div className={activeTab === 'directory' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4" : "space-y-6"}>
          {filteredUsers.length === 0 ? (
            <div className={activeTab === 'directory' ? "col-span-full text-center py-8" : "text-center py-8"}>
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchTerm ? `Tiada hasil untuk "${searchTerm}"` : 
                 activeTab === 'directory' ? 'Tiada staf dalam direktori' :
                 activeTab === 'pending' ? 'Tiada permohonan yang menunggu' :
                 'Tiada ahli yang diluluskan'}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              activeTab === 'directory' ? (
                <UserCard 
                  key={user.uid} 
                  user={user} 
                  userSkills={getUserSkills(user.uid)}
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
      )}

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

              {/* Bio */}
              {selectedUser.bio && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Bio</h4>
                  <p className="text-gray-700">{selectedUser.bio}</p>
                </div>
              )}

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
              {(() => {
                const userSkillsForModal = getUserSkills(selectedUser.uid);
                return userSkillsForModal.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 mb-2">Kemahiran</h4>
                    <div className="space-y-2">
                      {userSkillsForModal.map((userSkill) => (
                        <div key={userSkill.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="secondary" 
                              className={`${userSkill.verified ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                            >
                              <div className="flex items-center space-x-1">
                                <span>{userSkill.skillName}</span>
                                {userSkill.verified && (
                                  <Check className="h-3 w-3 text-blue-600" />
                                )}
                              </div>
                            </Badge>
                            {userSkill.verified && userSkill.verifiedByName && (
                              <span className="text-xs text-gray-500">
                                oleh {userSkill.verifiedByName}
                              </span>
                            )}
                          </div>
                          
                          {currentUser?.isAdmin && (
                            <div className="flex space-x-1">
                              {!userSkill.verified ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleVerifySkill(userSkill.id, true)}
                                  disabled={isUpdating === userSkill.id}
                                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-xs"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Sahkan
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVerifySkill(userSkill.id, false)}
                                  disabled={isUpdating === userSkill.id}
                                  className="text-red-600 border-red-200 hover:bg-red-50 px-2 py-1 text-xs"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Batal
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

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
      
      {/* Skill Management View */}
      {activeTab === 'manage-skills' && <SkillManagement />}
      
      {/* Admin User List View */}
      {activeTab === 'admin-users' && <AdminUserListView />}
    </div>
  );
}

interface UserCardProps {
  user: User;
  userSkills: UserSkill[];
  onClick: () => void;
  showDetails: boolean;
}

function UserCard({ user, userSkills, onClick, showDetails }: UserCardProps) {
  return (
    <Card 
      className="group hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-200 hover:border-gray-300 bg-white" 
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Profile Section */}
        <div className="flex items-center space-x-3 mb-3">
          {/* Profile Image */}
          {user.profileImageUrl ? (
            <img 
              src={user.profileImageUrl} 
              alt={user.fullname}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center border-2 border-gray-200">
              <span className="text-white font-bold text-lg">
                {user.fullname?.charAt(0) || 'U'}
              </span>
            </div>
          )}
          
          {/* Basic Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">
              {user.fullname || 'Nama Tidak Disetkan'}
            </h3>
            <p className="text-gray-600 text-xs mb-1">{user.staffId}</p>
            <Badge className={`${getStatusColor(user.availabilityStatus)} text-xs`} variant="secondary">
              {getStatusText(user.availabilityStatus)}
            </Badge>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-2 mb-3">
          {user.email && (
            <div className="flex items-center text-gray-600">
              <Mail className="h-3 w-3 mr-2 text-gray-400" />
              <span className="text-xs truncate">{user.email}</span>
            </div>
          )}
          
          {user.phoneNumber && (
            <div className="flex items-center text-gray-600">
              <Phone className="h-3 w-3 mr-2 text-gray-400" />
              <span className="text-xs">{user.phoneNumber}</span>
            </div>
          )}
        </div>

        {/* Bio */}
        {user.bio && (
          <div className="mb-3">
            <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{user.bio}</p>
          </div>
        )}

        {/* Skills */}
        {userSkills && userSkills.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {userSkills.slice(0, 3).map((userSkill, index) => (
                <span 
                  key={index} 
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                    userSkill.verified 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {userSkill.skillName}
                  {userSkill.verified && (
                    <Check className="h-3 w-3 text-blue-600" />
                  )}
                </span>
              ))}
              {userSkills.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  +{userSkills.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Admin Badge */}
        {user.isAdmin && (
          <div className="pt-3 border-t border-gray-100">
            <span className="px-2 py-1 bg-black text-white text-xs rounded font-medium">
              Admin
            </span>
          </div>
        )}
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