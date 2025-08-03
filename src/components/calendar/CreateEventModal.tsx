'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarEvent, CalendarEventType } from '@/types';
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users, FileText, Palette } from 'lucide-react';

interface CreateEventModalProps {
  onClose: () => void;
  onCreate: (eventData: Partial<CalendarEvent>) => void;
}

export default function CreateEventModal({ onClose, onCreate }: CreateEventModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: CalendarEventType.MEETING,
    location: '',
    attendees: [] as string[],
    color: '#8b5cf6',
    isAllDay: false,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    participantGroups: {
      freelance: false,
      partTime: false,
      fullTime: false
    },
    notificationSettings: {
      notifyFreelance: false,
      notifyPartTime: false,
      notifyFullTime: false
    }
  });

  const [attendeeInput, setAttendeeInput] = useState('');
  const [loading, setLoading] = useState(false);

  const eventTypes = [
    { value: CalendarEventType.MEETING, label: 'Mesyuarat', color: '#8b5cf6' },
    { value: CalendarEventType.TRAINING, label: 'Latihan', color: '#3b82f6' },
    { value: CalendarEventType.WORKSHOP, label: 'Bengkel', color: '#10b981' },
    { value: CalendarEventType.REVIEW, label: 'Semakan', color: '#f59e0b' },
    { value: CalendarEventType.PRESENTATION, label: 'Pembentangan', color: '#ec4899' },
    { value: CalendarEventType.CLIENT_MEETING, label: 'Mesyuarat Pelanggan', color: '#14b8a6' },
    { value: CalendarEventType.TEAM_BUILDING, label: 'Team Building', color: '#f97316' },
    { value: CalendarEventType.ANNOUNCEMENT, label: 'Pengumuman', color: '#ef4444' },
    { value: CalendarEventType.OTHER, label: 'Lain-lain', color: '#6b7280' }
  ];

  const colorOptions = [
    '#8b5cf6', // Purple
    '#3b82f6', // Blue  
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#ef4444', // Red
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316'  // Orange
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const startDateTime = formData.isAllDay 
        ? new Date(formData.startDate)
        : new Date(`${formData.startDate}T${formData.startTime}`);
      
      const endDateTime = formData.isAllDay
        ? new Date(formData.endDate || formData.startDate)
        : new Date(`${formData.endDate || formData.startDate}T${formData.endTime || formData.startTime}`);

      // Ensure end time is after start time
      if (endDateTime <= startDateTime) {
        if (formData.isAllDay) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        } else {
          endDateTime.setTime(startDateTime.getTime() + (60 * 60 * 1000)); // Add 1 hour
        }
      }

      const eventData: Partial<CalendarEvent> = {
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        location: formData.location || undefined,
        attendees: formData.attendees.length > 0 ? formData.attendees : undefined,
        color: formData.color,
        isAllDay: formData.isAllDay,
        start: startDateTime,
        end: endDateTime,
        participantGroups: formData.participantGroups,
        notificationSettings: formData.notificationSettings
      };

      await onCreate(eventData);
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setLoading(false);
    }
  };

  const addAttendee = () => {
    if (attendeeInput.trim() && !formData.attendees.includes(attendeeInput.trim())) {
      setFormData(prev => ({
        ...prev,
        attendees: [...prev.attendees, attendeeInput.trim()]
      }));
      setAttendeeInput('');
    }
  };

  const removeAttendee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.filter((_, i) => i !== index)
    }));
  };

  const handleTypeChange = (type: CalendarEventType) => {
    const selectedType = eventTypes.find(t => t.value === type);
    setFormData(prev => ({
      ...prev,
      type,
      color: selectedType?.color || prev.color
    }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Tambah Acara Baru</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Type */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Jenis Acara
              </label>
              <div className="flex flex-wrap gap-2">
                {eventTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleTypeChange(type.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.type === type.value
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Title */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Tajuk Acara *
              </label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                placeholder="Masukkan tajuk acara"
                required
              />
            </CardContent>
          </Card>

          {/* Date and Time */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <label className="text-sm font-medium text-gray-900 block">
                  Tarikh dan Masa
                </label>
                
                {/* All Day Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={formData.isAllDay}
                    onChange={(e) => setFormData(prev => ({...prev, isAllDay: e.target.checked}))}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="allDay" className="text-sm text-gray-700">
                    Sepanjang hari
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Tarikh Mula *
                    </label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                      required
                    />
                  </div>

                  {/* Start Time */}
                  {!formData.isAllDay && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Masa Mula *
                      </label>
                      <Input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData(prev => ({...prev, startTime: e.target.value}))}
                        required
                      />
                    </div>
                  )}

                  {/* End Date */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Tarikh Tamat
                    </label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                      min={formData.startDate}
                    />
                  </div>

                  {/* End Time */}
                  {!formData.isAllDay && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Masa Tamat
                      </label>
                      <Input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData(prev => ({...prev, endTime: e.target.value}))}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                Lokasi
              </label>
              <Input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({...prev, location: e.target.value}))}
                placeholder="Masukkan lokasi acara"
              />
            </CardContent>
          </Card>

          {/* Participant Groups */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <Users className="h-4 w-4 mr-1" />
                Kumpulan Peserta
              </label>
              
              <div className="space-y-4">
                {/* Freelance Group */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="freelance"
                      checked={formData.participantGroups.freelance}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        participantGroups: {
                          ...prev.participantGroups,
                          freelance: e.target.checked
                        }
                      }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="freelance" className="text-sm font-medium text-gray-700">
                      Freelance (FL)
                    </label>
                  </div>
                  {formData.participantGroups.freelance && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="notifyFreelance"
                        checked={formData.notificationSettings.notifyFreelance}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          notificationSettings: {
                            ...prev.notificationSettings,
                            notifyFreelance: e.target.checked
                          }
                        }))}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="notifyFreelance" className="text-xs text-gray-600">
                        Hantar notifikasi
                      </label>
                    </div>
                  )}
                </div>

                {/* Part Time Group */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="partTime"
                      checked={formData.participantGroups.partTime}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        participantGroups: {
                          ...prev.participantGroups,
                          partTime: e.target.checked
                        }
                      }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="partTime" className="text-sm font-medium text-gray-700">
                      Part Time (PT)
                    </label>
                  </div>
                  {formData.participantGroups.partTime && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="notifyPartTime"
                        checked={formData.notificationSettings.notifyPartTime}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          notificationSettings: {
                            ...prev.notificationSettings,
                            notifyPartTime: e.target.checked
                          }
                        }))}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="notifyPartTime" className="text-xs text-gray-600">
                        Hantar notifikasi
                      </label>
                    </div>
                  )}
                </div>

                {/* Full Time Group */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="fullTime"
                      checked={formData.participantGroups.fullTime}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        participantGroups: {
                          ...prev.participantGroups,
                          fullTime: e.target.checked
                        }
                      }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="fullTime" className="text-sm font-medium text-gray-700">
                      Full Time (FT)
                    </label>
                  </div>
                  {formData.participantGroups.fullTime && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="notifyFullTime"
                        checked={formData.notificationSettings.notifyFullTime}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          notificationSettings: {
                            ...prev.notificationSettings,
                            notifyFullTime: e.target.checked
                          }
                        }))}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="notifyFullTime" className="text-xs text-gray-600">
                        Hantar notifikasi
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Attendees (Optional) */}
              <div className="mt-4 pt-4 border-t">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Peserta Tambahan (Opsional)
                </label>
                <div className="flex space-x-2 mb-2">
                  <Input
                    type="text"
                    value={attendeeInput}
                    onChange={(e) => setAttendeeInput(e.target.value)}
                    placeholder="Nama peserta tambahan"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAttendee())}
                  />
                  <Button type="button" onClick={addAttendee} variant="outline">
                    Tambah
                  </Button>
                </div>
                {formData.attendees.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.attendees.map((attendee, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeAttendee(index)}
                      >
                        {attendee} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Color */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                <Palette className="h-4 w-4 mr-1" />
                Warna
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, color}))}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-1" />
                Keterangan
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                placeholder="Masukkan keterangan acara"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || !formData.title || !formData.startDate}>
              {loading ? 'Menyimpan...' : 'Simpan Acara'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}