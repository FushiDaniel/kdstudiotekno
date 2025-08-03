'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Task, CalendarEvent, CalendarEventType, TaskStatus } from '@/types';
import { collection, query, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import { Plus, Eye, Calendar as CalendarIcon, Users, Clock } from 'lucide-react';
import EventDetailModal from './EventDetailModal';
import CreateEventModal from './CreateEventModal';
import { CalendarEventExtended } from './types';

// Import Calendar components conditionally
let Calendar: any = null;
let localizer: any = null;

if (typeof window !== 'undefined') {
  const { Calendar: RBCCalendar, momentLocalizer } = require('react-big-calendar');
  const moment = require('moment');
  
  Calendar = RBCCalendar;
  localizer = momentLocalizer(moment);
  
  // Import CSS
  require('react-big-calendar/lib/css/react-big-calendar.css');
}

export default function CalendarView() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [currentView, setCurrentView] = useState<any>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventExtended | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Combine tasks and calendar events into calendar format
  const calendarData = useMemo(() => {
    const events: CalendarEventExtended[] = [];

    // Add tasks as events
    tasks.forEach(task => {
      // Add task deadline as event
      events.push({
        id: `task-deadline-${task.id}`,
        title: `📋 ${task.name} (Deadline)`,
        start: task.deadline,
        end: task.deadline,
        type: CalendarEventType.DEADLINE,
        relatedTaskId: task.id,
        description: task.description,
        createdBy: task.createdBy,
        createdByName: task.createdByName,
        color: '#ef4444',
        originalEvent: task
      });

      // Add task duration if it has start and end dates
      if (task.startDate && task.status === TaskStatus.IN_PROGRESS) {
        const endDate = task.completedAt || new Date();
        events.push({
          id: `task-duration-${task.id}`,
          title: `🔄 ${task.name}`,
          start: task.startDate,
          end: endDate,
          type: CalendarEventType.TASK,
          relatedTaskId: task.id,
          description: task.description,
          createdBy: task.createdBy,
          createdByName: task.createdByName,
          color: '#3b82f6',
          originalEvent: task
        });
      } else if (task.startDate && task.completedAt) {
        events.push({
          id: `task-completed-${task.id}`,
          title: `✅ ${task.name}`,
          start: task.startDate,
          end: task.completedAt,
          type: CalendarEventType.TASK,
          relatedTaskId: task.id,
          description: task.description,
          createdBy: task.createdBy,
          createdByName: task.createdByName,
          color: '#22c55e',
          originalEvent: task
        });
      }
    });

    // Add manual calendar events
    calendarEvents.forEach(event => {
      events.push({
        id: event.id,
        title: `${getEventIcon(event.type)} ${event.title}`,
        start: event.start,
        end: event.end,
        type: event.type,
        description: event.description,
        createdBy: event.createdBy,
        createdByName: event.createdByName,
        color: event.color || getEventColor(event.type),
        originalEvent: event
      });
    });

    return events;
  }, [tasks, calendarEvents]);

  const getEventIcon = (type: CalendarEventType) => {
    switch (type) {
      case CalendarEventType.MEETING:
        return '👥';
      case CalendarEventType.DEADLINE:
        return '⏰';
      case CalendarEventType.TASK:
        return '📋';
      case CalendarEventType.TRAINING:
        return '🎓';
      case CalendarEventType.WORKSHOP:
        return '🛠️';
      case CalendarEventType.REVIEW:
        return '🔍';
      case CalendarEventType.PRESENTATION:
        return '📊';
      case CalendarEventType.CLIENT_MEETING:
        return '🤝';
      case CalendarEventType.TEAM_BUILDING:
        return '🎯';
      case CalendarEventType.ANNOUNCEMENT:
        return '📢';
      default:
        return '📅';
    }
  };

  const getEventColor = (type: CalendarEventType) => {
    switch (type) {
      case CalendarEventType.MEETING:
        return '#8b5cf6';
      case CalendarEventType.DEADLINE:
        return '#ef4444';
      case CalendarEventType.TASK:
        return '#3b82f6';
      case CalendarEventType.TRAINING:
        return '#3b82f6';
      case CalendarEventType.WORKSHOP:
        return '#10b981';
      case CalendarEventType.REVIEW:
        return '#f59e0b';
      case CalendarEventType.PRESENTATION:
        return '#ec4899';
      case CalendarEventType.CLIENT_MEETING:
        return '#14b8a6';
      case CalendarEventType.TEAM_BUILDING:
        return '#f97316';
      case CalendarEventType.ANNOUNCEMENT:
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  useEffect(() => {
    if (!user) return;

    // Listen for all tasks
    const tasksQuery = query(collection(db, 'tasks'));
    const tasksUnsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        deadline: doc.data().deadline?.toDate(),
        assignedAt: doc.data().assignedAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
        submittedAt: doc.data().submittedAt?.toDate(),
        startDate: doc.data().startDate?.toDate(),
      })) as Task[];
      
      setTasks(tasksData);
      setLoading(false);
    });

    // Listen for calendar events
    const eventsQuery = query(collection(db, 'calendar'));
    const eventsUnsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: doc.data().start?.toDate(),
        end: doc.data().end?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as CalendarEvent[];
      
      setCalendarEvents(eventsData);
    }, (error) => {
      console.error('Error fetching calendar events:', error);
    });

    return () => {
      tasksUnsubscribe();
      eventsUnsubscribe();
    };
  }, [user]);

  const handleEventSelect = (event: CalendarEventExtended) => {
    setSelectedEvent(event);
  };

  const handleCreateEvent = async (eventData: Partial<CalendarEvent>) => {
    if (!user) return;

    try {
      // Save event to Firebase
      const docRef = await addDoc(collection(db, 'calendar'), {
        ...eventData,
        createdBy: user.uid,
        createdByName: user.fullname,
        createdAt: Timestamp.fromDate(new Date()),
        start: Timestamp.fromDate(eventData.start!),
        end: Timestamp.fromDate(eventData.end!),
      });

      // Send email notifications if enabled
      if (eventData.notificationSettings) {
        const notificationData = {
          eventId: docRef.id,
          eventTitle: eventData.title,
          eventDescription: eventData.description,
          eventStart: eventData.start?.toISOString(),
          eventEnd: eventData.end?.toISOString(),
          eventType: eventData.type,
          location: eventData.location,
          notificationSettings: eventData.notificationSettings,
          participantGroups: eventData.participantGroups,
          createdByName: user.fullname
        };

        try {
          await fetch('/api/send-calendar-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(notificationData),
          });
        } catch (notificationError) {
          console.error('Error sending notifications:', notificationError);
          // Don't fail the event creation if notification fails
        }
      }

      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const eventStyleGetter = (event: CalendarEventExtended) => {
    return {
      style: {
        backgroundColor: event.color,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  if (loading || !isClient) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!Calendar || !localizer) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Kalendar</h1>
          <p className="text-gray-600">Kalendar tidak dapat dimuatkan. Sila muat semula halaman.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Kalendar & Gantt Chart</h1>
            <p className="text-gray-600">Lihat tugasan dan acara dalam kalendar</p>
          </div>
          {user?.isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Acara
            </Button>
          )}
        </div>

        {/* Calendar Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CalendarIcon className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Tugasan</p>
                  <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Acara Manual</p>
                  <p className="text-2xl font-bold text-gray-900">{calendarEvents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Tugasan Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Eye className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Acara</p>
                  <p className="text-2xl font-bold text-gray-900">{calendarData.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Calendar Component */}
      <Card>
        <CardContent className="p-6">
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={calendarData}
              startAccessor="start"
              endAccessor="end"
              view={currentView}
              onView={setCurrentView}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={handleEventSelect}
              eventPropGetter={eventStyleGetter}
              popup
              views={['month', 'week', 'day', 'agenda']}
              messages={{
                next: "Berikut",
                previous: "Sebelum",
                today: "Hari Ini",
                month: "Bulan",
                week: "Minggu", 
                day: "Hari",
                agenda: "Agenda",
                date: "Tarikh",
                time: "Masa",
                event: "Acara",
                noEventsInRange: "Tiada acara dalam tempoh ini"
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Create Event Modal */}
      {showCreateModal && user?.isAdmin && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateEvent}
        />
      )}
    </div>
  );
}