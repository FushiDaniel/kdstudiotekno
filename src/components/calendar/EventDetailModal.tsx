'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarEventType, TaskStatus, Task, CalendarEvent } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Calendar, Clock, User, MapPin, Users, FileText, DollarSign } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { CalendarEventExtended } from './types';

interface EventDetailModalProps {
  event: CalendarEventExtended;
  onClose: () => void;
}

export default function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const isTask = event.type === CalendarEventType.TASK || event.type === CalendarEventType.DEADLINE;
  const taskData = isTask ? (event.originalEvent as Task) : null;

  const getEventTypeLabel = (type: CalendarEventType) => {
    switch (type) {
      case CalendarEventType.TASK:
        return 'Tugasan';
      case CalendarEventType.MEETING:
        return 'Mesyuarat';
      case CalendarEventType.DEADLINE:
        return 'Tarikh Akhir';
      case CalendarEventType.TRAINING:
        return 'Latihan';
      case CalendarEventType.WORKSHOP:
        return 'Bengkel';
      case CalendarEventType.REVIEW:
        return 'Semakan';
      case CalendarEventType.PRESENTATION:
        return 'Pembentangan';
      case CalendarEventType.CLIENT_MEETING:
        return 'Mesyuarat Pelanggan';
      case CalendarEventType.TEAM_BUILDING:
        return 'Team Building';
      case CalendarEventType.ANNOUNCEMENT:
        return 'Pengumuman';
      default:
        return 'Lain-lain';
    }
  };

  const getEventTypeColor = (type: CalendarEventType) => {
    switch (type) {
      case CalendarEventType.TASK:
        return 'bg-blue-100 text-blue-800';
      case CalendarEventType.MEETING:
        return 'bg-purple-100 text-purple-800';
      case CalendarEventType.DEADLINE:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStatusLabel = (status: TaskStatus) => {
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

  const getTaskStatusColor = (status: TaskStatus) => {
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Detail Acara</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Type and Title */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Badge className={getEventTypeColor(event.type)}>
                {getEventTypeLabel(event.type)}
              </Badge>
              {taskData && (
                <Badge className={getTaskStatusColor(taskData.status)}>
                  {getTaskStatusLabel(taskData.status)}
                </Badge>
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 break-words">
              {String(event.title).replace(/^[📋👥⏰📅✅🔄]\s/, '')}
            </h2>
          </div>

          {/* Time Information */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Mula</p>
                    <p className="text-sm text-gray-600">{event.start ? formatDate(event.start) : 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Tamat</p>
                    <p className="text-sm text-gray-600">{event.end ? formatDate(event.end) : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Creator Information */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Dicipta oleh</p>
                  <p className="text-sm text-gray-600">{event.createdByName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task-specific Information */}
          {taskData && (
            <>
              {/* Task Amount */}
              {taskData.amount && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Jumlah</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(taskData.amount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Task Skills */}
              {taskData.skills && taskData.skills.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">Kemahiran Diperlukan</p>
                    <div className="flex flex-wrap gap-1">
                      {taskData.skills.map((skill: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Assignment Information */}
              {taskData.assignedToName && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Ditugaskan kepada</p>
                        <p className="text-sm text-gray-600">
                          {taskData.assignedToName} ({taskData.assignedToStaffId})
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Manual Event Information */}
          {!isTask && event.originalEvent && (
            <>
              {/* Location */}
              {(event.originalEvent as CalendarEvent).location && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Lokasi</p>
                        <p className="text-sm text-gray-600">{(event.originalEvent as CalendarEvent).location}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Participant Groups */}
              {(event.originalEvent as CalendarEvent).participantGroups && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-2">
                      <Users className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-2">Kumpulan Peserta</p>
                        <div className="space-y-2">
                          {(event.originalEvent as CalendarEvent).participantGroups!.freelance && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">• Freelance (FL)</span>
                              {(event.originalEvent as CalendarEvent).notificationSettings?.notifyFreelance && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Notifikasi dihantar
                                </span>
                              )}
                            </div>
                          )}
                          {(event.originalEvent as CalendarEvent).participantGroups!.partTime && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">• Part Time (PT)</span>
                              {(event.originalEvent as CalendarEvent).notificationSettings?.notifyPartTime && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Notifikasi dihantar
                                </span>
                              )}
                            </div>
                          )}
                          {(event.originalEvent as CalendarEvent).participantGroups!.fullTime && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">• Full Time (FT)</span>
                              {(event.originalEvent as CalendarEvent).notificationSettings?.notifyFullTime && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Notifikasi dihantar
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Attendees */}
              {(event.originalEvent as CalendarEvent).attendees && (event.originalEvent as CalendarEvent).attendees!.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-2">
                      <Users className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Peserta Tambahan</p>
                        <div className="text-sm text-gray-600">
                          {(event.originalEvent as CalendarEvent).attendees!.map((attendee: string, index: number) => (
                            <div key={index}>• {attendee}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Description */}
          {event.description && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start space-x-2">
                  <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-2">Keterangan</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed break-words">
                        {event.description}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}