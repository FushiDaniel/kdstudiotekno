'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Task, TaskStatus, TaskPaymentStatus } from '@/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DollarSign, Calendar, CheckCircle, Clock, FileText, Filter, ChevronDown } from 'lucide-react';

interface PartTimePayment {
  id: string;
  userId: string;
  userFullName: string;
  userStaffId: string;
  amount: number;
  month: number;
  year: number;
  description: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
}

type FilterPeriod = 'current' | 'all' | 'custom';

export default function PaymentView() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('current');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'all-users' | 'my-freelance' | 'part-time'>('my-freelance');
  const [ptPayments, setPtPayments] = useState<PartTimePayment[]>([]);
  const [ptLoading, setPtLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Different queries based on active tab for PT users
    let q;
    if (user.staffId?.startsWith('PT')) {
      if (activeTab === 'all-users') {
        // Show all completed tasks for all users
        q = query(collection(db, 'tasks'), where('status', '==', 'COMPLETED'));
      } else if (activeTab === 'my-freelance') {
        // Show only PT user's own freelance tasks
        q = query(collection(db, 'tasks'), where('assignedTo', '==', user.uid));
      } else {
        // part-time tab - no tasks needed, only PT payments
        setTasks([]);
        setLoading(false);
        return;
      }
    } else {
      // Non-PT users only see their own tasks
      q = query(collection(db, 'tasks'), where('assignedTo', '==', user.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        deadline: doc.data().deadline?.toDate(),
        assignedAt: doc.data().assignedAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
        submittedAt: doc.data().submittedAt?.toDate(),
        startDate: doc.data().startDate?.toDate(),
      })) as Task[];
      
      // Sort manually to avoid index requirement
      const sortedTasks = userTasks.sort((a, b) => 
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      );
      
      setTasks(sortedTasks);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeTab]);

  // Fetch Part Time payments for PT users
  useEffect(() => {
    if (!user?.staffId?.startsWith('PT')) return;

    setPtLoading(true);
    const q = query(
      collection(db, 'partTimePayments'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as PartTimePayment[];
      
      // Sort by creation date (most recent first)
      const sortedPayments = payments.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      setPtPayments(sortedPayments);
      setPtLoading(false);
    }, (error) => {
      console.error('Error fetching PT payments:', error);
      setPtLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter tasks based on selected period
  const getFilteredTasks = () => {
    // Only show tasks with COMPLETED payment status for earnings calculation
    const completedTasks = tasks.filter(t => 
      t.status === TaskStatus.COMPLETED && t.paymentStatus === TaskPaymentStatus.COMPLETED
    );
    // Show pending tasks (submitted but not yet approved) and approved payments pending
    const pendingTasks = tasks.filter(t => 
      t.status === TaskStatus.SUBMITTED || 
      (t.status === TaskStatus.COMPLETED && t.paymentStatus === TaskPaymentStatus.PENDING)
    );

    if (filterPeriod === 'current') {
      // Current month only
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      return {
        completed: completedTasks.filter(task => {
          const taskDate = task.completedAt || task.createdAt;
          return taskDate && taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
        }),
        pending: pendingTasks.filter(task => {
          const taskDate = task.submittedAt || task.createdAt;
          return taskDate && taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
        })
      };
    } else if (filterPeriod === 'custom') {
      // Selected month and year
      return {
        completed: completedTasks.filter(task => {
          const taskDate = task.completedAt || task.createdAt;
          return taskDate && taskDate.getMonth() === selectedMonth && taskDate.getFullYear() === selectedYear;
        }),
        pending: pendingTasks.filter(task => {
          const taskDate = task.submittedAt || task.createdAt;
          return taskDate && taskDate.getMonth() === selectedMonth && taskDate.getFullYear() === selectedYear;
        })
      };
    } else {
      // All time
      return { completed: completedTasks, pending: pendingTasks };
    }
  };

  const { completed: filteredCompleted, pending: filteredPending } = getFilteredTasks();
  const totalEarnings = filteredCompleted.reduce((sum, task) => sum + task.amount, 0);
  const pendingEarnings = filteredPending.reduce((sum, task) => sum + task.amount, 0);

  // Current month earnings for summary card - only COMPLETED payments count as earnings
  const currentMonthEarnings = tasks
    .filter(t => {
      if (t.status !== TaskStatus.COMPLETED || t.paymentStatus !== TaskPaymentStatus.COMPLETED) return false;
      const taskDate = t.completedAt || t.createdAt;
      if (!taskDate) return false;
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      return taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
    })
    .reduce((sum, task) => sum + task.amount, 0);

  // Generate month options for dropdown
  const getMonthOptions = () => {
    const months = [];
    const currentDate = new Date();
    
    // Get last 24 months
    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push({
        value: date.getMonth(),
        year: date.getFullYear(),
        label: date.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })
      });
    }
    
    return months;
  };

  const monthOptions = getMonthOptions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Payment & Gaji</h1>
            <p className="text-sm sm:text-base text-gray-600">Pantau pendapatan dan status bayaran anda</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 whitespace-nowrap"
          >
            <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Filter Tempoh</span>
            <span className="sm:hidden">Filter</span>
            <ChevronDown className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <Card className="mb-4 sm:mb-6">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 sm:items-center">
                <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                  <Button
                    variant={filterPeriod === 'current' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterPeriod('current')}
                    className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                  >
                    Bulan Ini
                  </Button>
                  <Button
                    variant={filterPeriod === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterPeriod('all')}
                    className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                  >
                    Semua
                  </Button>
                  <Button
                    variant={filterPeriod === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterPeriod('custom')}
                    className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                  >
                    Pilih Bulan
                  </Button>
                </div>

                {filterPeriod === 'custom' && (
                  <div className="w-full sm:w-auto">
                    <select
                      value={`${selectedMonth}-${selectedYear}`}
                      onChange={(e) => {
                        const [month, year] = e.target.value.split('-').map(Number);
                        setSelectedMonth(month);
                        setSelectedYear(year);
                      }}
                      className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md text-xs sm:text-sm bg-white"
                    >
                      {monthOptions.map((option) => (
                        <option key={`${option.value}-${option.year}`} value={`${option.value}-${option.year}`}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="text-xs sm:text-sm text-gray-600 w-full sm:w-auto">
                  Menunjukkan: {filteredCompleted.length + filteredPending.length} tugasan
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            {user?.staffId?.startsWith('PT') ? (
              // PT users get 3 tabs
              <>
                <button
                  onClick={() => setActiveTab('all-users')}
                  className={`px-2 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 min-w-0 ${
                    activeTab === 'all-users'
                      ? 'bg-gray-800 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="sm:hidden">Semua</span>
                  <span className="hidden sm:inline">Semua Pengguna</span>
                </button>
                <button
                  onClick={() => setActiveTab('my-freelance')}
                  className={`px-2 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 min-w-0 ${
                    activeTab === 'my-freelance'
                      ? 'bg-gray-800 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="sm:hidden">Tugasan</span>
                  <span className="hidden sm:inline">Tugasan Saya</span>
                </button>
                <button
                  onClick={() => setActiveTab('part-time')}
                  className={`px-2 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 min-w-0 ${
                    activeTab === 'part-time'
                      ? 'bg-gray-800 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="sm:hidden">Bayaran</span>
                  <span className="hidden sm:inline">Bayaran Part Time</span>
                </button>
              </>
            ) : (
              // Non-PT users get only 1 tab
              <button
                onClick={() => setActiveTab('my-freelance')}
                className="px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-2xl font-medium text-sm bg-gray-800 text-white shadow-md flex-shrink-0"
              >
                <span className="sm:hidden">Tugasan Saya</span>
                <span className="hidden sm:inline">Tugasan / Freelance Saya</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEarnings)}</div>
            <p className="text-xs text-muted-foreground">
              Dari {filteredCompleted.length} tugasan selesai
              {filterPeriod !== 'all' && (
                <span className="block">
                  ({filterPeriod === 'current' ? 'Bulan ini' : 
                    monthOptions.find(m => m.value === selectedMonth && m.year === selectedYear)?.label})
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Menunggu Bayaran</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingEarnings)}</div>
            <p className="text-xs text-muted-foreground">
              Dari {filteredPending.length} tugasan diserahkan
              {filterPeriod !== 'all' && (
                <span className="block">
                  ({filterPeriod === 'current' ? 'Bulan ini' : 
                    monthOptions.find(m => m.value === selectedMonth && m.year === selectedYear)?.label})
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bulan Ini</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonthEarnings)}</div>
            <p className="text-xs text-muted-foreground">
              Pendapatan bulan semasa
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Payment History - Show for all-users and my-freelance tabs */}
      {(activeTab === 'all-users' || activeTab === 'my-freelance') && (
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === 'all-users' ? 'Sejarah Tugasan & Bayaran (Semua Pengguna)' : 
               activeTab === 'my-freelance' ? 'Sejarah Tugasan & Bayaran Saya' : 
               'Sejarah Tugasan & Bayaran'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...filteredCompleted, ...filteredPending].length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {filterPeriod === 'current' ? 'Tiada tugasan bulan ini' :
                   filterPeriod === 'custom' ? `Tiada tugasan untuk ${monthOptions.find(m => m.value === selectedMonth && m.year === selectedYear)?.label}` :
                   activeTab === 'all-users' ? 'Tiada sejarah tugasan untuk semua pengguna' :
                   'Tiada sejarah tugasan yang boleh dibayar'}
                </div>
              ) : (
                [...filteredCompleted, ...filteredPending]
                  .sort((a, b) => (b.completedAt || b.submittedAt || b.createdAt).getTime() - 
                                 (a.completedAt || a.submittedAt || a.createdAt).getTime())
                  .map((task) => (
                    <PaymentTaskCard key={task.id} task={task} showUserInfo={activeTab === 'all-users'} />
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Part Time Payment Section */}
      {user?.staffId?.startsWith('PT') && activeTab === 'part-time' && (
        <Card>
          <CardHeader>
            <CardTitle>Bayaran Part Time</CardTitle>
          </CardHeader>
          <CardContent>
            {ptLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : ptPayments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Tiada Bayaran Part Time</h3>
                <p>Belum ada bayaran Part Time yang direkodkan.</p>
                <p className="text-sm mt-2">Sila hubungi admin untuk maklumat lanjut.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ptPayments.map((payment) => (
                  <PartTimePaymentCard key={payment.id} payment={payment} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PaymentTaskCardProps {
  task: Task;
  showUserInfo?: boolean;
}

function PaymentTaskCard({ task, showUserInfo = false }: PaymentTaskCardProps) {
  const getPaymentStatusColor = (status: TaskPaymentStatus) => {
    switch (status) {
      case TaskPaymentStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskPaymentStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case TaskPaymentStatus.APPROVED:
        return 'bg-blue-100 text-blue-800';
      case TaskPaymentStatus.DENIED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskStatus.SUBMITTED:
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 break-words text-sm sm:text-base">{task.name}</h3>
            <p className="text-xs sm:text-sm text-gray-600 font-mono break-all">ID: {task.id}</p>
            {showUserInfo && task.assignedToName && (
              <p className="text-xs sm:text-sm text-blue-600 font-medium mt-1">
                👤 {task.assignedToName} ({task.assignedToStaffId})
              </p>
            )}
          </div>
          <div className="text-left sm:text-right flex-shrink-0">
            <div className="text-lg sm:text-xl font-bold">{formatCurrency(task.amount)}</div>
            {task.originalAmount && task.originalAmount !== task.amount && (
              <div className="text-xs sm:text-sm mb-2">
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
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Badge className={`${getTaskStatusColor(task.status)} text-xs`}>
                {task.status === TaskStatus.COMPLETED ? 'Selesai' : task.status}
              </Badge>
              <Badge className={`${getPaymentStatusColor(task.paymentStatus)} text-xs`}>
                {task.paymentStatus === TaskPaymentStatus.PENDING ? 'Menunggu Kelulusan' :
                 task.paymentStatus === TaskPaymentStatus.COMPLETED ? 'Bayaran Selesai' :
                 task.paymentStatus === TaskPaymentStatus.APPROVED ? 'Diluluskan' :
                 task.paymentStatus === TaskPaymentStatus.DENIED ? 'Ditolak' :
                 'Belum Diproses'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">
              {task.status === TaskStatus.COMPLETED ? 'Selesai' : 'Diserahkan'}: {' '}
              {formatDate(task.completedAt || task.submittedAt || task.createdAt)}
            </span>
          </div>
          <div className="flex items-center">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Deadline: {formatDateTime(task.deadline)}</span>
          </div>
        </div>

        {task.status === TaskStatus.COMPLETED && task.paymentStatus === TaskPaymentStatus.COMPLETED && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
            <span className="text-sm text-green-800">Bayaran telah selesai</span>
          </div>
        )}

        {task.status === TaskStatus.SUBMITTED && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
            <Clock className="h-4 w-4 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-800">
              Menunggu semakan admin sebelum bayaran diproses
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PartTimePaymentCardProps {
  payment: PartTimePayment;
}

function PartTimePaymentCard({ payment }: PartTimePaymentCardProps) {
  const getMonthName = (month: number) => {
    return new Date(2024, month).toLocaleDateString('ms-MY', { month: 'long' });
  };

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">
              Bayaran {getMonthName(payment.month)} {payment.year}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-2">{payment.description}</p>
            <p className="text-xs sm:text-sm text-gray-500 font-mono break-all">ID: {payment.id}</p>
          </div>
          <div className="text-left sm:text-right flex-shrink-0">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(payment.amount)}</div>
            <Badge className="bg-green-100 text-green-800 mt-2 text-xs">
              Bayaran Selesai
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Direkod: {formatDate(payment.createdAt)}</span>
          </div>
          <div className="flex items-center">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Oleh: {payment.createdByName}</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 mr-2 flex-shrink-0" />
          <span className="text-xs sm:text-sm text-green-800">Bayaran telah direkodkan dalam sistem</span>
        </div>
      </CardContent>
    </Card>
  );
}
