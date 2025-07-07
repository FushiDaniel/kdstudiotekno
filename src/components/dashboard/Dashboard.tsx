'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText, 
  DollarSign,
  ChevronDown,
  ChevronUp,
  Calendar
} from 'lucide-react';
import { Task, TaskStatus, TaskPaymentStatus } from '@/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskType, setSelectedTaskType] = useState<'active' | 'completed'>('active');
  const [showPastEarnings, setShowPastEarnings] = useState(false);

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

  const taskStats = {
    completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
    needsRevision: tasks.filter(t => t.status === TaskStatus.NEEDS_REVISION).length,
    submitted: tasks.filter(t => t.status === TaskStatus.SUBMITTED).length,
  };

  // Current month earnings - only count COMPLETED payments
  const currentMonthEarnings = tasks
    .filter(t => {
      if (t.status !== TaskStatus.COMPLETED || t.paymentStatus !== TaskPaymentStatus.COMPLETED) return false;
      const taskDate = t.completedAt || t.createdAt;
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      return taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
    })
    .reduce((sum, task) => sum + task.amount, 0);

  const pendingEarnings = tasks
    .filter(t => t.status === TaskStatus.SUBMITTED)
    .reduce((sum, task) => sum + task.amount, 0);

  // Calculate past months earnings
  const getMonthlyEarnings = () => {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 1; i <= 6; i++) { // Show last 6 months
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString('ms-MY', { 
        month: 'long', 
        year: 'numeric' 
      });
      
      const monthEarnings = tasks
        .filter(t => {
          if (t.status !== TaskStatus.COMPLETED || t.paymentStatus !== TaskPaymentStatus.COMPLETED) return false;
          const taskDate = t.completedAt || t.createdAt;
          return taskDate.getMonth() === monthDate.getMonth() && 
                 taskDate.getFullYear() === monthDate.getFullYear();
        })
        .reduce((sum, task) => sum + task.amount, 0);
      
      months.push({
        name: monthName,
        earnings: monthEarnings,
        taskCount: tasks.filter(t => {
          if (t.status !== TaskStatus.COMPLETED || t.paymentStatus !== TaskPaymentStatus.COMPLETED) return false;
          const taskDate = t.completedAt || t.createdAt;
          return taskDate.getMonth() === monthDate.getMonth() && 
                 taskDate.getFullYear() === monthDate.getFullYear();
        }).length
      });
    }
    
    return months;
  };

  const pastMonthsEarnings = getMonthlyEarnings();

  const activeTasks = tasks.filter(t => 
    t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.NEEDS_REVISION
  );

  const completedTasks = tasks.filter(t => 
    t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SUBMITTED
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">
                {user?.fullname?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user?.fullname}</h2>
              <p className="text-gray-600">{user?.staffId}</p>
            </div>
          </div>

          {/* Current Month Earnings Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Pendapatan Bulan Ini</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPastEarnings(!showPastEarnings)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Bulan Lepas
                  {showPastEarnings ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Selesai</p>
                  <p className="text-2xl font-bold">{formatCurrency(currentMonthEarnings)}</p>
                </div>
                <div className="border-l border-gray-200 pl-6">
                  <p className="text-sm text-gray-600">Belum Selesai</p>
                  <p className="text-xl font-semibold text-gray-500">{formatCurrency(pendingEarnings)}</p>
                </div>
              </div>
              
              {/* Past Months Earnings */}
              {showPastEarnings && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Pendapatan Bulan-Bulan Lepas</h4>
                  <div className="space-y-3">
                    {pastMonthsEarnings.map((month, index) => (
                      <div key={index} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{month.name}</p>
                          <p className="text-xs text-gray-500">{month.taskCount} tugasan selesai</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(month.earnings)}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total past earnings */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Jumlah 6 Bulan Lepas</p>
                      <p className="text-base font-bold text-gray-900">
                        {formatCurrency(pastMonthsEarnings.reduce((sum, month) => sum + month.earnings, 0))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Sedang Dilaksanakan"
            value={taskStats.inProgress}
            icon={<Clock className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            title="Perlu Pembetulan"
            value={taskStats.needsRevision}
            icon={<XCircle className="h-5 w-5" />}
            color="red"
          />
          <StatCard
            title="Menunggu Semakan"
            value={taskStats.submitted}
            icon={<FileText className="h-5 w-5" />}
            color="purple"
          />
          <StatCard
            title="Selesai"
            value={taskStats.completed}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
          />
        </div>

        {/* Tasks Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tugasan</CardTitle>
              <div className="flex space-x-2">
                <Button
                  variant={selectedTaskType === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTaskType('active')}
                >
                  Aktif
                </Button>
                <Button
                  variant={selectedTaskType === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTaskType('completed')}
                >
                  Selesai
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(selectedTaskType === 'active' ? activeTasks : completedTasks).map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              
              {(selectedTaskType === 'active' ? activeTasks : completedTasks).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Tiada tugasan {selectedTaskType === 'active' ? 'aktif' : 'selesai'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'purple' | 'green';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskCardProps {
  task: Task;
}

function TaskCard({ task }: TaskCardProps) {
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case TaskStatus.NEEDS_REVISION:
        return 'bg-red-100 text-red-800';
      case TaskStatus.SUBMITTED:
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900">{task.name}</h3>
          <Badge className={getStatusColor(task.status)}>
            {task.status}
          </Badge>
        </div>
        
        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-500">
            <DollarSign className="h-4 w-4 mr-1" />
            {formatCurrency(task.amount)}
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1" />
            {formatDate(task.deadline)}
          </div>
        </div>
        
        {task.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {task.skills.map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}