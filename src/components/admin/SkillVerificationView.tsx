'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserSkill, User } from '@/types';
import { collection, query, onSnapshot, doc, updateDoc, Timestamp, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Check, X, Award, User as UserIcon, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';

export default function SkillVerificationView() {
  const [userSkills, setUserSkills] = useState<(UserSkill & { userFullName: string; userStaffId: string })[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified'>('pending');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  // Load users
  useEffect(() => {
    const usersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as User[];
      setUsers(usersData);
    });

    return unsubscribe;
  }, []);

  // Load user skills
  useEffect(() => {
    const userSkillsQuery = query(collection(db, 'userSkills'));
    const unsubscribe = onSnapshot(userSkillsQuery, (snapshot) => {
      const skillsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const user = users.find(u => u.uid === data.userId);
        return {
          id: doc.id,
          ...data,
          assignedAt: data.assignedAt?.toDate() || new Date(),
          verifiedAt: data.verifiedAt?.toDate(),
          userFullName: user?.fullname || 'Unknown User',
          userStaffId: user?.staffId || 'Unknown ID'
        };
      }) as (UserSkill & { userFullName: string; userStaffId: string })[];
      
      setUserSkills(skillsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [users]);

  const handleVerifySkill = async (userSkillId: string, verified: boolean) => {
    if (!currentUser) return;

    setUpdating(userSkillId);
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
      setUpdating(null);
    }
  };

  const getFilteredSkills = () => {
    let filtered = userSkills;

    // Filter by status
    if (filterStatus === 'pending') {
      filtered = filtered.filter(skill => !skill.verified);
    } else if (filterStatus === 'verified') {
      filtered = filtered.filter(skill => skill.verified);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(skill => 
        skill.skillName.toLowerCase().includes(searchLower) ||
        skill.userFullName.toLowerCase().includes(searchLower) ||
        skill.userStaffId.toLowerCase().includes(searchLower)
      );
    }

    return filtered.sort((a, b) => {
      // Sort by verification status (pending first), then by date
      if (a.verified !== b.verified) {
        return a.verified ? 1 : -1;
      }
      return b.assignedAt.getTime() - a.assignedAt.getTime();
    });
  };

  const getStatusCounts = () => {
    return {
      total: userSkills.length,
      pending: userSkills.filter(skill => !skill.verified).length,
      verified: userSkills.filter(skill => skill.verified).length
    };
  };

  const filteredSkills = getFilteredSkills();
  const counts = getStatusCounts();

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
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Pengesahan Kemahiran</h1>
        <p className="text-lg text-gray-600">Sahkan kemahiran yang telah ditambah oleh pengguna</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mr-3">
                <Award className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Jumlah Kemahiran</p>
                <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Menunggu Pengesahan</p>
                <p className="text-2xl font-bold text-gray-900">{counts.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Telah Disahkan</p>
                <p className="text-2xl font-bold text-gray-900">{counts.verified}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari mengikut kemahiran, nama pengguna atau ID staf..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterStatus('all')}
            className={filterStatus === 'all' ? 'bg-white shadow-sm' : ''}
          >
            Semua ({counts.total})
          </Button>
          <Button
            variant={filterStatus === 'pending' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterStatus('pending')}
            className={filterStatus === 'pending' ? 'bg-white shadow-sm' : ''}
          >
            Menunggu ({counts.pending})
          </Button>
          <Button
            variant={filterStatus === 'verified' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterStatus('verified')}
            className={filterStatus === 'verified' ? 'bg-white shadow-sm' : ''}
          >
            Disahkan ({counts.verified})
          </Button>
        </div>
      </div>

      {/* Skills List */}
      <div className="space-y-4">
        {filteredSkills.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Award className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchTerm 
                  ? `Tiada hasil untuk "${searchTerm}"` 
                  : filterStatus === 'pending' 
                    ? 'Tiada kemahiran yang menunggu pengesahan'
                    : filterStatus === 'verified'
                      ? 'Tiada kemahiran yang telah disahkan'
                      : 'Tiada kemahiran dijumpai'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSkills.map((userSkill) => (
            <Card key={userSkill.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{userSkill.userFullName}</h3>
                        <p className="text-sm text-gray-500">{userSkill.userStaffId}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 mb-3">
                      <Badge variant="secondary" className="text-sm">
                        {userSkill.skillName}
                      </Badge>
                      {userSkill.verified ? (
                        <Badge className="bg-green-100 text-green-800 text-sm">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Disahkan
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-800 text-sm">
                          <Clock className="h-3 w-3 mr-1" />
                          Menunggu
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Ditambah pada: {formatDate(userSkill.assignedAt)}</p>
                      {userSkill.verified && userSkill.verifiedAt && userSkill.verifiedByName && (
                        <p>Disahkan oleh {userSkill.verifiedByName} pada {formatDate(userSkill.verifiedAt)}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    {!userSkill.verified ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleVerifySkill(userSkill.id, true)}
                          disabled={updating === userSkill.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          {updating === userSkill.id ? 'Mengesahkan...' : 'Sahkan'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleVerifySkill(userSkill.id, false)}
                          disabled={updating === userSkill.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Tolak
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerifySkill(userSkill.id, false)}
                        disabled={updating === userSkill.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        {updating === userSkill.id ? 'Membatalkan...' : 'Batal Sahkan'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}