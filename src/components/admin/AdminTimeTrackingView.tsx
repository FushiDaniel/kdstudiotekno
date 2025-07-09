'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClockInRecord, User } from '@/types';
import { collection, query, onSnapshot, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate, formatTime } from '@/lib/utils';
import { Clock, MapPin, Search, Calendar, Users, Filter } from 'lucide-react';

export default function AdminTimeTrackingView() {
  const [clockInRecords, setClockInRecords] = useState<ClockInRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<ClockInRecord | null>(null);
  const [showMap, setShowMap] = useState(false);

  // Fetch all FT and PT users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers = usersSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        })) as User[];
        
        // Filter for FT and PT users only
        const ftPtUsers = allUsers.filter(user => 
          user.staffId?.startsWith('FT') || user.staffId?.startsWith('PT')
        );
        
        setUsers(ftPtUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  // Fetch clock-in records
  useEffect(() => {
    const q = query(
      collection(db, 'clockInRecords'),
      orderBy('clockInTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const records = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            clockInTime: data.clockInTime?.toDate() || new Date(),
            clockOutTime: data.clockOutTime?.toDate(),
          } as ClockInRecord;
        });
        
        // Filter for FT and PT users only
        const ftPtRecords = records.filter(record => 
          record.userStaffId?.startsWith('FT') || record.userStaffId?.startsWith('PT')
        );
        
        setClockInRecords(ftPtRecords);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching clock in records:', error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Filter records based on search criteria
  const filteredRecords = useMemo(() => {
    let filtered = clockInRecords;

    // Filter by search term (user name or staff ID)
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.userFullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.userStaffId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by selected user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(record => record.userId === selectedUser);
    }

    // Filter by selected date
    if (selectedDate) {
      filtered = filtered.filter(record => record.date === selectedDate);
    }

    return filtered;
  }, [clockInRecords, searchTerm, selectedUser, selectedDate]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}j ${mins}m`;
  };

  const getTotalHoursForUser = (userId: string, date?: string) => {
    let userRecords = clockInRecords.filter(record => record.userId === userId);
    
    if (date) {
      userRecords = userRecords.filter(record => record.date === date);
    }
    
    const totalMinutes = userRecords.reduce((total, record) => 
      total + (record.totalMinutes || 0), 0
    );
    
    return formatDuration(totalMinutes);
  };

  const openMapModal = useCallback((record: ClockInRecord) => {
    setSelectedRecord(record);
    setShowMap(true);
  }, []);

  const closeMapModal = useCallback(() => {
    setShowMap(false);
  }, []);

  const MapModal = useMemo(() => {
    if (!selectedRecord || !selectedRecord.coordinates) return null;

    const { latitude, longitude } = selectedRecord.coordinates;
    const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900">
                Lokasi Clock In - {selectedRecord.userFullName}
              </CardTitle>
              <Button 
                variant="ghost" 
                onClick={closeMapModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-96">
              <iframe
                key={`map-${selectedRecord.id}`}
                src={mapUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="p-4 bg-gray-50">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Masa:</span> {formatTime(selectedRecord.clockInTime)}
                </div>
                <div>
                  <span className="font-medium">Tarikh:</span> {formatDate(selectedRecord.clockInTime)}
                </div>
                <div>
                  <span className="font-medium">Koordinat:</span> {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </div>
                <div>
                  <span className="font-medium">Ketepatan:</span> {selectedRecord.coordinates.accuracy?.toFixed(0)}m
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }, [selectedRecord, closeMapModal]);

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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Admin - Pantau Masa Pekerja
        </h1>
        <p className="text-gray-600">
          Pantau rekod clock in/out untuk pekerja FT dan PT
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari nama atau ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Pekerja</option>
                {users.map(user => (
                  <option key={user.uid} value={user.uid}>
                    {user.fullname} ({user.staffId})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center text-sm text-gray-600">
              <Filter className="h-4 w-4 mr-2" />
              {filteredRecords.length} rekod
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Pekerja Aktif</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Clock In Hari Ini</p>
                <p className="text-2xl font-bold">
                  {clockInRecords.filter(r => r.date === new Date().toISOString().split('T')[0]).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Rekod</p>
                <p className="text-2xl font-bold">{clockInRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rekod Clock In/Out</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Pekerja</th>
                  <th className="text-left p-3 font-medium">Tarikh</th>
                  <th className="text-left p-3 font-medium">Clock In</th>
                  <th className="text-left p-3 font-medium">Clock Out</th>
                  <th className="text-left p-3 font-medium">Tempoh</th>
                  <th className="text-left p-3 font-medium">Lokasi</th>
                  <th className="text-left p-3 font-medium">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{record.userFullName}</div>
                        <div className="text-sm text-gray-500">{record.userStaffId}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      {formatDate(record.clockInTime)}
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        {formatTime(record.clockInTime)}
                      </div>
                    </td>
                    <td className="p-3">
                      {record.clockOutTime ? (
                        <div className="text-sm">
                          {formatTime(record.clockOutTime)}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Aktif
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {record.totalMinutes ? (
                        formatDuration(record.totalMinutes)
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm truncate max-w-32">
                          {record.location || 'Tidak diketahui'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      {record.coordinates && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openMapModal(record)}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Peta
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Tiada rekod ditemui
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Map Modal */}
      {showMap && MapModal}
    </div>
  );
}