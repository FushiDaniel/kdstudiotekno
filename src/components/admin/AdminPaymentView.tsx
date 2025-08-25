'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Task, TaskStatus, TaskPaymentStatus, User } from '@/types';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseCache } from '@/lib/firebase-cache';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DollarSign, CheckCircle, XCircle, Search, Users, Calendar, FileText, CreditCard } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { notificationService } from '@/lib/notifications';
import Swal from 'sweetalert2';

export default function AdminPaymentView() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<TaskPaymentStatus | 'all'>('all');
  const [processingPayments, setProcessingPayments] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'tasks' | 'parttime'>('tasks');
  const [partTimeUsers, setPartTimeUsers] = useState<User[]>([]);
  const [selectedPTUser, setSelectedPTUser] = useState<string>('');
  const [ptPaymentAmount, setPtPaymentAmount] = useState('');
  const [ptPaymentMonth, setPtPaymentMonth] = useState(new Date().getMonth());
  const [ptPaymentYear, setPtPaymentYear] = useState(new Date().getFullYear());
  const [ptPaymentDescription, setPtPaymentDescription] = useState('');
  const [isCreatingPTPayment, setIsCreatingPTPayment] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);

  // Fetch tasks with completed status for payment processing using cache
  useEffect(() => {
    const unsubscribe = firebaseCache.setupRealtimeListener<Task>(
      'tasks',
      (completedTasks) => {
        // Sort by reviewed date (most recent first)
        const sortedTasks = completedTasks.sort((a, b) => 
          (b.reviewedAt?.getTime() || 0) - (a.reviewedAt?.getTime() || 0)
        );
        
        setTasks(sortedTasks);
        setLoading(false);
        console.log(`💰 AdminPaymentView: Loaded ${sortedTasks.length} completed tasks from cache/firestore`);
      },
      {
        where: [['status', '==', TaskStatus.COMPLETED]]
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch users for dropdown - bypass cache temporarily
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        // Bypass cache and fetch directly from Firestore
        const usersQuery = query(collection(db, 'users'));
        const snapshot = await getDocs(usersQuery);
        const allUsers = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          uid: doc.id, // Ensure uid is set
        })) as User[];
        
        setUsers(allUsers.filter(u => !u.isAdmin)); // Only non-admin users
        
        // Filter Part Time users - include all users with PT prefix regardless of admin status
        const ptUsers = allUsers.filter(u => u.staffId?.startsWith('PT'));
        setPartTimeUsers(ptUsers);
        
        console.log(`👥 AdminPaymentView: Loaded ${allUsers.length} users directly from Firestore`);
        console.log(`👥 PT Users details:`, ptUsers.map(u => ({ 
          uid: u.uid, 
          id: u.id,
          name: u.fullname, 
          staffId: u.staffId, 
          isAdmin: u.isAdmin 
        })));
        
        // Clear the cache for users to ensure fresh data
        firebaseCache.clearCollectionCache('users');
      } catch (error) {
        console.error('Error fetching users directly:', error);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handlePaymentAction = async (taskId: string, action: 'approve' | 'deny') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !user) return;

    // Check if user is Part Time - they cannot approve payments for others
    if (user.staffId?.startsWith('PT') && action === 'approve') {
      Swal.fire({
        icon: 'warning',
        title: 'Tidak Dibenarkan',
        text: 'Pekerja Part Time tidak dibenarkan meluluskan bayaran untuk orang lain.',
        confirmButtonColor: '#374151'
      });
      return;
    }

    setProcessingPayments(prev => new Set(prev).add(taskId));

    try {
      const now = new Date();
      const newPaymentStatus = action === 'approve' ? TaskPaymentStatus.COMPLETED : TaskPaymentStatus.DENIED;
      
      const updates = {
        paymentStatus: newPaymentStatus,
        paymentProcessedAt: Timestamp.fromDate(now),
        paymentProcessedBy: {
          uid: user.uid,
          fullname: user.fullname,
          staffId: user.staffId
        }
      };

      await updateDoc(doc(db, 'tasks', taskId), updates);

      // Send notification to user
      if (task.assignedTo) {
        const assignedUser = users.find(u => u.uid === task.assignedTo);
        const userEmail = assignedUser?.email || 'user@email.com';
        
        if (action === 'approve') {
          await notificationService.notifyPaymentCompleted(
            task.assignedTo,
            userEmail,
            task.name,
            formatCurrency(task.amount),
            task.id
          );
        } else {
          await notificationService.sendNotification(
            task.assignedTo,
            userEmail,
            'Bayaran Ditolak',
            `Bayaran untuk tugasan "${task.name}" telah ditolak. Sila hubungi admin untuk maklumat lanjut.`,
            'payment_completed',
            task.id
          );
        }
      }

      // Update local state
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates, paymentProcessedAt: now } : t));
      
      console.log(`Payment ${action === 'approve' ? 'approved' : 'denied'} for task: ${task.name}`);
    } catch (error) {
      console.error(`Error ${action === 'approve' ? 'approving' : 'denying'} payment:`, error);
      Swal.fire({
        icon: 'error',
        title: 'Ralat Berlaku',
        text: `Gagal ${action === 'approve' ? 'meluluskan' : 'menolak'} bayaran. Sila cuba lagi.`,
        confirmButtonColor: '#374151'
      });
    } finally {
      setProcessingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleCreatePTPayment = async () => {
    if (!user || !selectedPTUser || !ptPaymentAmount || ptPaymentAmount.trim() === '') {
      Swal.fire({
        icon: 'warning',
        title: 'Maklumat Tidak Lengkap',
        text: 'Sila isi semua maklumat yang diperlukan.',
        confirmButtonColor: '#374151'
      });
      return;
    }

    const amount = parseFloat(ptPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Jumlah Tidak Sah',
        text: 'Sila masukkan jumlah bayaran yang sah.',
        confirmButtonColor: '#374151'
      });
      return;
    }

    console.log('=== PT PAYMENT DEBUG START ===');
    console.log('Selected PT User ID:', selectedPTUser);
    console.log('Selected PT User ID type:', typeof selectedPTUser);
    console.log('Available PT Users:', partTimeUsers.map(u => ({ 
      uid: u.uid, 
      id: u.id,
      name: u.fullname, 
      staffId: u.staffId,
      uidType: typeof u.uid,
      idType: typeof u.id
    })));
    console.log('All users count:', users.length);
    console.log('PT users count:', partTimeUsers.length);

    // Try to find user - check both uid and id fields for compatibility
    let selectedUser = partTimeUsers.find(u => u.uid === selectedPTUser || u.id === selectedPTUser);
    console.log('Found in partTimeUsers:', selectedUser);
    
    // If not found in partTimeUsers, check all users as fallback
    if (!selectedUser) {
      console.log('User not found in partTimeUsers, checking all users...');
      console.log('Looking for uid/id:', selectedPTUser, 'with PT prefix');
      selectedUser = users.find(u => {
        const matchesId = u.uid === selectedPTUser || u.id === selectedPTUser;
        const hasPTPrefix = u.staffId?.startsWith('PT');
        console.log('Checking user:', u.uid || u.id, u.staffId, 'matches:', matchesId && hasPTPrefix);
        return matchesId && hasPTPrefix;
      });
      
      if (selectedUser) {
        console.log('Found user in all users list:', selectedUser);
        // Update partTimeUsers to include this user for future reference
        setPartTimeUsers(prev => {
          const userKey = selectedUser!.uid || selectedUser!.id;
          if (!prev.find(u => (u.uid || u.id) === userKey)) {
            return [...prev, selectedUser!];
          }
          return prev;
        });
      } else {
        console.log('User still not found in all users');
        console.log('All users with PT staffId:', users.filter(u => u.staffId?.startsWith('PT')));
      }
    }

    console.log('Final selected user:', selectedUser);
    console.log('=== PT PAYMENT DEBUG END ===');
    
    if (!selectedUser) {
      console.error('PT user not found in both lists. PT Users available:', partTimeUsers.length, 'All users:', users.length);
      console.error('All users with PT staffId:', users.filter(u => u.staffId?.startsWith('PT')));
      Swal.fire({
        icon: 'error',
        title: 'Pengguna Tidak Dijumpai',
        text: `Pekerja Part Time yang dipilih tidak sah. (${partTimeUsers.length} PT users tersedia)`,
        confirmButtonColor: '#374151'
      });
      return;
    }

    // Double check the user is actually a PT user
    if (!selectedUser.staffId?.startsWith('PT')) {
      console.error('Selected user is not a PT user:', selectedUser.staffId);
      Swal.fire({
        icon: 'error',
        title: 'Pengguna Tidak Sah',
        text: 'Pengguna yang dipilih bukan pekerja Part Time.',
        confirmButtonColor: '#374151'
      });
      return;
    }

    setIsCreatingPTPayment(true);
    try {
      const paymentData = {
        userId: selectedUser.uid || selectedUser.id, // Use the actual user ID from the found user
        userFullName: selectedUser.fullname,
        userStaffId: selectedUser.staffId,
        amount: amount,
        month: ptPaymentMonth,
        year: ptPaymentYear,
        description: ptPaymentDescription || `Bayaran Part Time ${new Date(ptPaymentYear, ptPaymentMonth).toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })}`,
        createdAt: Timestamp.fromDate(new Date()),
        createdBy: user.uid,
        createdByName: user.fullname
      };
      
      console.log('Creating PT payment with data:', paymentData);
      console.log('Database reference:', db);
      console.log('User auth status:', user);

      const docRef = await addDoc(collection(db, 'partTimePayments'), paymentData);
      
      console.log('PT payment created successfully with ID:', docRef.id);

      // Reset form
      setSelectedPTUser('');
      setPtPaymentAmount('');
      setPtPaymentDescription('');
      
      Swal.fire({
        icon: 'success',
        title: 'Berjaya!',
        text: 'Bayaran Part Time berjaya ditambah!',
        confirmButtonColor: '#059669'
      });
    } catch (error: any) {
      console.error('Detailed error creating PT payment:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      
      let errorMessage = 'Gagal menambah bayaran Part Time. ';
      
      if (error?.code === 'permission-denied') {
        errorMessage += 'Anda tidak mempunyai kebenaran untuk menambah bayaran.';
      } else if (error?.code === 'unavailable') {
        errorMessage += 'Perkhidmatan tidak tersedia pada masa ini.';
      } else if (error?.message) {
        errorMessage += `Error: ${error.message}`;
      } else {
        errorMessage += 'Sila cuba lagi.';
      }
      
      Swal.fire({
        icon: 'error',
        title: 'Ralat Berlaku',
        text: errorMessage,
        confirmButtonColor: '#374151'
      });
    } finally {
      setIsCreatingPTPayment(false);
    }
  };

  // Filter tasks based on search and filters
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.assignedToName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.assignedToStaffId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesUser = selectedUser === 'all' || task.assignedTo === selectedUser;
    const matchesPaymentStatus = selectedPaymentStatus === 'all' || task.paymentStatus === selectedPaymentStatus;
    
    return matchesSearch && matchesUser && matchesPaymentStatus;
  });

  const getPaymentStatusBadge = (status: TaskPaymentStatus) => {
    switch (status) {
      case TaskPaymentStatus.PENDING:
        return { label: 'Menunggu Kelulusan', color: 'bg-yellow-100 text-yellow-800' };
      case TaskPaymentStatus.COMPLETED:
        return { label: 'Bayaran Selesai', color: 'bg-green-100 text-green-800' };
      case TaskPaymentStatus.DENIED:
        return { label: 'Bayaran Ditolak', color: 'bg-red-100 text-red-800' };
      default:
        return { label: 'Belum Diproses', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const paymentStats = {
    pending: tasks.filter(t => t.paymentStatus === TaskPaymentStatus.PENDING).length,
    completed: tasks.filter(t => t.paymentStatus === TaskPaymentStatus.COMPLETED).length,
    denied: tasks.filter(t => t.paymentStatus === TaskPaymentStatus.DENIED).length,
    totalAmount: tasks
      .filter(t => t.paymentStatus === TaskPaymentStatus.PENDING)
      .reduce((sum, task) => sum + task.amount, 0)
  };

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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin - Urus Bayaran</h1>
        <p className="text-gray-600">Kelola bayaran tugasan dan Part Time</p>
        
        {/* Tab Navigation */}
        <div className="mt-6">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-6 py-3 rounded-2xl font-medium text-sm transition-all duration-200 ${
                activeTab === 'tasks'
                  ? 'bg-gray-800 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Bayaran Tugasan
            </button>
            <button
              onClick={() => setActiveTab('parttime')}
              className={`px-6 py-3 rounded-2xl font-medium text-sm transition-all duration-200 ${
                activeTab === 'parttime'
                  ? 'bg-gray-800 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Bayaran Part Time
            </button>
          </div>
        </div>
      </div>

      {/* Task Payment Content */}
      {activeTab === 'tasks' && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Menunggu Kelulusan</p>
                <p className="text-2xl font-bold text-yellow-600">{paymentStats.pending}</p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-100">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Jumlah Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(paymentStats.totalAmount)}</p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-100">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Bayaran Selesai</p>
                <p className="text-2xl font-bold text-green-600">{paymentStats.completed}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Bayaran Ditolak</p>
                <p className="text-2xl font-bold text-red-600">{paymentStats.denied}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari tugasan atau nama pengguna..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="all">Semua Pengguna</option>
            {users.map(user => (
              <option key={user.uid} value={user.uid}>
                {user.fullname} ({user.staffId})
              </option>
            ))}
          </select>

          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value as TaskPaymentStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="all">Semua Status</option>
            <option value={TaskPaymentStatus.PENDING}>Menunggu Kelulusan</option>
            <option value={TaskPaymentStatus.COMPLETED}>Bayaran Selesai</option>
            <option value={TaskPaymentStatus.DENIED}>Bayaran Ditolak</option>
          </select>
        </div>
      </div>

      {/* Payment Tasks List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              {searchTerm ? 
                `Tiada tugasan ditemui untuk "${searchTerm}"` : 
                'Tiada tugasan untuk bayaran'
              }
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <PaymentTaskCard 
              key={task.id} 
              task={task} 
              users={users}
              onApprove={() => handlePaymentAction(task.id, 'approve')}
              onDeny={() => handlePaymentAction(task.id, 'deny')}
              isProcessing={processingPayments.has(task.id)}
              getPaymentStatusBadge={getPaymentStatusBadge}
            />
          ))
        )}
      </div>
        </>
      )}

      {/* Part Time Payment Content */}
      {activeTab === 'parttime' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tambah Bayaran Part Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Pekerja Part Time
                  </label>
                  <select
                    value={selectedPTUser}
                    onChange={(e) => setSelectedPTUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled={usersLoading}
                  >
                    <option value="">
                      {usersLoading ? 'Memuat pekerja...' : 
                       partTimeUsers.length === 0 ? 'Tiada pekerja Part Time tersedia' :
                       'Pilih pekerja...'}
                    </option>
                    {partTimeUsers.map(user => (
                      <option key={user.uid || user.id} value={user.uid || user.id}>
                        {user.fullname} ({user.staffId})
                      </option>
                    ))}
                  </select>
                  {partTimeUsers.length === 0 && !usersLoading && (
                    <p className="text-sm text-red-600 mt-1">
                      Tiada pekerja Part Time dijumpai. Sila pastikan pekerja mempunyai Staff ID bermula dengan 'PT'.
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah Bayaran (RM)
                  </label>
                  <Input
                    type="number"
                    value={ptPaymentAmount}
                    onChange={(e) => setPtPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bulan
                  </label>
                  <select
                    value={ptPaymentMonth}
                    onChange={(e) => setPtPaymentMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {Array.from({length: 12}, (_, i) => (
                      <option key={i} value={i}>
                        {new Date(2024, i).toLocaleDateString('ms-MY', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tahun
                  </label>
                  <select
                    value={ptPaymentYear}
                    onChange={(e) => setPtPaymentYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {Array.from({length: 3}, (_, i) => {
                      const year = new Date().getFullYear() - 1 + i;
                      return (
                        <option key={year} value={year}>{year}</option>
                      );
                    })}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keterangan (Opsional)
                  </label>
                  <Input
                    value={ptPaymentDescription}
                    onChange={(e) => setPtPaymentDescription(e.target.value)}
                    placeholder="Keterangan tambahan..."
                  />
                </div>

                <div className="md:col-span-2">
                  <Button 
                    onClick={handleCreatePTPayment}
                    disabled={isCreatingPTPayment || !selectedPTUser || !ptPaymentAmount}
                    className="w-full"
                  >
                    {isCreatingPTPayment ? 'Memproses...' : 'Tambah Bayaran'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface PaymentTaskCardProps {
  task: Task;
  users: User[];
  onApprove: () => void;
  onDeny: () => void;
  isProcessing: boolean;
  getPaymentStatusBadge: (status: TaskPaymentStatus) => { label: string; color: string };
}

function PaymentTaskCard({ task, users, onApprove, onDeny, isProcessing, getPaymentStatusBadge }: PaymentTaskCardProps) {
  const paymentBadge = getPaymentStatusBadge(task.paymentStatus);
  const assignedUser = users.find(u => u.uid === task.assignedTo);
  
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-gray-900 break-words flex-1">{task.name}</h3>
              <Badge className={paymentBadge.color}>
                {paymentBadge.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-3 break-words overflow-wrap-anywhere">{task.description}</p>
            <div className="mb-3">
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded break-all">
                ID Tugasan: {task.id}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center min-w-0">
                <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{task.assignedToName} ({task.assignedToStaffId})</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Selesai: {formatDate(task.completedAt || task.reviewedAt || task.createdAt)}</span>
              </div>
            </div>
            
            {/* User Bank Details for Admin */}
            {assignedUser && (assignedUser.bankName || assignedUser.bankAccountNumber) && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <CreditCard className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-2">Maklumat Bank Pengguna:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-blue-700 font-medium">Nama: </span>
                        <span className="text-blue-800">{assignedUser.fullname}</span>
                      </div>
                      {assignedUser.bankName && (
                        <div>
                          <span className="text-blue-700 font-medium">Bank: </span>
                          <span className="text-blue-800">{assignedUser.bankName}</span>
                        </div>
                      )}
                      {assignedUser.bankAccountNumber && (
                        <div className="sm:col-span-2">
                          <span className="text-blue-700 font-medium">No. Akaun: </span>
                          <span className="text-blue-800 font-mono">{assignedUser.bankAccountNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {assignedUser && !assignedUser.bankName && !assignedUser.bankAccountNumber && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <CreditCard className="h-4 w-4 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Amaran:</p>
                    <p className="text-sm text-yellow-700">Pengguna belum mengisi maklumat bank. Sila minta pengguna kemaskini profil mereka.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="text-right ml-6">
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {formatCurrency(task.amount)}
              {task.originalAmount && task.originalAmount !== task.amount && (
                <div className="text-sm font-normal">
                  Asal: <span className="line-through">{formatCurrency(task.originalAmount)}</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    task.amount > task.originalAmount 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {task.amount > task.originalAmount ? 'Bonus Tambahan' : 'Potongan Dibuat'}
                  </span>
                </div>
              )}
            </div>
            
            {task.paymentStatus === TaskPaymentStatus.PENDING && (
              <div className="flex space-x-2">
                <Button
                  onClick={onApprove}
                  disabled={isProcessing}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {isProcessing ? 'Memproses...' : 'Luluskan'}
                </Button>
                <Button
                  onClick={onDeny}
                  disabled={isProcessing}
                  size="sm"
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  {isProcessing ? 'Memproses...' : 'Tolak'}
                </Button>
              </div>
            )}
            
            {task.paymentStatus === TaskPaymentStatus.COMPLETED && (
              <div className="text-sm text-green-600 font-medium">
                ✓ Bayaran telah diluluskan
              </div>
            )}
            
            {task.paymentStatus === TaskPaymentStatus.DENIED && (
              <div className="text-sm text-red-600 font-medium">
                ✗ Bayaran ditolak
              </div>
            )}
          </div>
        </div>

        {task.adminFeedback && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start">
              <FileText className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Maklum Balas Admin:</p>
                <p className="text-sm text-gray-600">{task.adminFeedback}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}