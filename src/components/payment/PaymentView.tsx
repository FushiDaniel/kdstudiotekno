'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task, TaskStatus, TaskPaymentStatus } from '@/types';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DollarSign, Calendar, CheckCircle, Clock, FileText } from 'lucide-react';

export default function PaymentView() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', user.uid)
    );

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
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      setTasks(sortedTasks);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
  const pendingTasks = tasks.filter(t => t.status === TaskStatus.SUBMITTED);
  
  const totalEarnings = completedTasks.reduce((sum, task) => sum + task.amount, 0);
  const pendingEarnings = pendingTasks.reduce((sum, task) => sum + task.amount, 0);
  
  const currentMonthEarnings = completedTasks
    .filter(task => {
      const taskDate = task.completedAt || task.createdAt;
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      return taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
    })
    .reduce((sum, task) => sum + task.amount, 0);

  const getPaymentStatusColor = (status: TaskPaymentStatus) => {
    switch (status) {
      case TaskPaymentStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskPaymentStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment & Gaji</h1>
        <p className="text-gray-600">Pantau pendapatan dan status bayaran anda</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEarnings)}</div>
            <p className="text-xs text-muted-foreground">
              Dari {completedTasks.length} tugasan selesai
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
              Dari {pendingTasks.length} tugasan diserahkan
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

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Sejarah Tugasan & Bayaran</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...completedTasks, ...pendingTasks].length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Tiada sejarah tugasan yang boleh dibayar
              </div>
            ) : (
              [...completedTasks, ...pendingTasks]
                .sort((a, b) => (b.completedAt || b.submittedAt || b.createdAt).getTime() - 
                               (a.completedAt || a.submittedAt || a.createdAt).getTime())
                .map((task) => (
                  <PaymentTaskCard key={task.id} task={task} />
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface PaymentTaskCardProps {
  task: Task;
}

function PaymentTaskCard({ task }: PaymentTaskCardProps) {
  const getPaymentStatusColor = (status: TaskPaymentStatus) => {
    switch (status) {
      case TaskPaymentStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskPaymentStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
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
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">{task.name}</h3>
            <p className="text-sm text-gray-600">ID: {task.id}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{formatCurrency(task.amount)}</div>
            <div className="flex space-x-2">
              <Badge className={getTaskStatusColor(task.status)}>
                {task.status}
              </Badge>
              <Badge className={getPaymentStatusColor(task.paymentStatus)}>
                {task.paymentStatus}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            <span>
              {task.status === TaskStatus.COMPLETED ? 'Selesai' : 'Diserahkan'}: {' '}
              {formatDate(task.completedAt || task.submittedAt || task.createdAt)}
            </span>
          </div>
          <div className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            <span>Deadline: {formatDate(task.deadline)}</span>
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