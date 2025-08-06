'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Task, TaskStatus } from '@/types';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseCache } from '@/lib/firebase-cache';
import { formatCurrency, formatDate, formatMessageWithLinks } from '@/lib/utils';
import { Clock, DollarSign, FileText, CheckCircle } from 'lucide-react';
import TaskDetailView from './TaskDetailView';

export default function TaskView() {
  const { user } = useAuth();
  const [userTasks, setUserTasks] = useState<Task[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [selectedView, setSelectedView] = useState<'my-tasks' | 'open-tasks'>('my-tasks');
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'Selesai';
      case TaskStatus.IN_PROGRESS:
        return 'Sedang Dilaksanakan';
      case TaskStatus.NEEDS_REVISION:
        return 'Perlu Pembetulan';
      case TaskStatus.SUBMITTED:
        return 'Menunggu Semakan';
      case TaskStatus.NOT_STARTED:
        return 'Belum Dimulakan';
      default:
        return status;
    }
  };

  useEffect(() => {
    if (!user) return;

    // Use cached realtime listener for user's assigned tasks
    const userTasksUnsubscribe = firebaseCache.setupRealtimeListener<Task>(
      'tasks',
      (tasks) => {
        // Sort manually to avoid index requirement
        const sortedTasks = tasks.sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        setUserTasks(sortedTasks);
        setLoading(false);
        console.log(`📋 TaskView: Loaded ${sortedTasks.length} user tasks from cache/firestore`);
      },
      {
        where: [['assignedTo', '==', user.uid]]
      }
    );

    // Use cached realtime listener for open tasks
    const openTasksUnsubscribe = firebaseCache.setupRealtimeListener<Task>(
      'tasks',
      (tasks) => {
        // Filter out assigned tasks and sort manually
        const openTasks = tasks
          .filter(task => !task.assignedTo)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setOpenTasks(openTasks);
        console.log(`📋 TaskView: Loaded ${openTasks.length} open tasks from cache/firestore`);
      },
      {
        where: [['status', '==', TaskStatus.NOT_STARTED]]
      }
    );

    return () => {
      userTasksUnsubscribe();
      openTasksUnsubscribe();
    };
  }, [user]);

  const handleTakeTask = async (taskId: string) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        assignedTo: user.uid,
        assignedToName: user.fullname,
        assignedToStaffId: user.staffId,
        assignedAt: Timestamp.fromDate(new Date()),
        status: TaskStatus.IN_PROGRESS,
        startDate: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error taking task:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (selectedTask) {
    return (
      <TaskDetailView 
        task={selectedTask} 
        onBack={() => setSelectedTask(null)}
        onUpdate={(updatedTask) => {
          setUserTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          setSelectedTask(updatedTask);
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Tugasan</h1>
        
        {/* Toggle Buttons */}
        <div className="flex space-x-2">
          <Button
            variant={selectedView === 'my-tasks' ? 'default' : 'outline'}
            onClick={() => setSelectedView('my-tasks')}
          >
            Tugasan Saya ({userTasks.length})
          </Button>
          <Button
            variant={selectedView === 'open-tasks' ? 'default' : 'outline'}
            onClick={() => setSelectedView('open-tasks')}
          >
            Tugasan Terbuka ({openTasks.length})
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {selectedView === 'my-tasks' ? (
          <>
            {userTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  Tiada tugasan yang diberikan kepada anda
                </CardContent>
              </Card>
            ) : (
              userTasks.map((task) => (
                <UserTaskCard 
                  key={task.id} 
                  task={task} 
                  onTaskSelect={setSelectedTask}
                  getStatusColor={getStatusColor}
                  getStatusBadge={getStatusBadge}
                />
              ))
            )}
          </>
        ) : (
          <>
            {openTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  Tiada tugasan terbuka pada masa ini
                </CardContent>
              </Card>
            ) : (
              openTasks.map((task) => (
                <OpenTaskCard 
                  key={task.id} 
                  task={task} 
                  onTakeTask={() => handleTakeTask(task.id)}
                  onTaskSelect={setSelectedTask}
                  getStatusColor={getStatusColor}
                  getStatusBadge={getStatusBadge}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface UserTaskCardProps {
  task: Task;
  onTaskSelect: (task: Task) => void;
  getStatusColor: (status: TaskStatus) => string;
  getStatusBadge: (status: TaskStatus) => string;
}

function UserTaskCard({ task, onTaskSelect, getStatusColor, getStatusBadge }: UserTaskCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 mr-4">
            <CardTitle className="text-lg text-gray-900 mb-1 break-words">{task.name}</CardTitle>
            <p className="text-sm text-gray-500 font-mono break-all">ID: {task.id}</p>
          </div>
          <Badge className={getStatusColor(task.status)}>
            {getStatusBadge(task.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed font-sans max-h-24 overflow-y-auto break-words overflow-wrap-anywhere">
            {formatMessageWithLinks(task.description)}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm font-medium text-gray-900">
            <DollarSign className="h-4 w-4 mr-2 text-green-600" />
            {formatCurrency(task.amount)}
          </div>
          <div className="flex items-center text-sm text-gray-700">
            <Clock className="h-4 w-4 mr-2 text-orange-500" />
            {formatDate(task.deadline)}
          </div>
        </div>
        
        {task.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {task.skills.map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => onTaskSelect(task)}
        >
          <FileText className="h-4 w-4 mr-2" />
          Lihat Detail
        </Button>
      </CardContent>
    </Card>
  );
}

interface OpenTaskCardProps {
  task: Task;
  onTakeTask: () => void;
  onTaskSelect: (task: Task) => void;
  getStatusColor: (status: TaskStatus) => string;
  getStatusBadge: (status: TaskStatus) => string;
}

function OpenTaskCard({ task, onTakeTask, onTaskSelect, getStatusColor, getStatusBadge }: OpenTaskCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 mr-4">
            <CardTitle className="text-lg text-gray-900 mb-1 break-words">{task.name}</CardTitle>
            <p className="text-sm text-gray-500 font-mono break-all">ID: {task.id}</p>
          </div>
          <Badge className={getStatusColor(task.status)}>
            {getStatusBadge(task.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed font-sans max-h-24 overflow-y-auto break-words overflow-wrap-anywhere">
            {formatMessageWithLinks(task.description)}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm font-medium text-gray-900">
            <DollarSign className="h-4 w-4 mr-2 text-green-600" />
            {formatCurrency(task.amount)}
          </div>
          <div className="flex items-center text-sm text-gray-700">
            <Clock className="h-4 w-4 mr-2 text-orange-500" />
            {formatDate(task.deadline)}
          </div>
        </div>
        
        {task.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {task.skills.map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => onTaskSelect(task)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Lihat Detail
          </Button>
          <Button 
            className="flex-1"
            onClick={onTakeTask}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Ambil Tugasan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}