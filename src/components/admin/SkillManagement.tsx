'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skill } from '@/types';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, X, Search, Award, Trash2, Edit3, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';

export default function SkillManagement() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user: currentUser } = useAuth();

  // Load skills
  useEffect(() => {
    const skillsQuery = query(collection(db, 'skills'));
    const unsubscribe = onSnapshot(skillsQuery, (snapshot) => {
      const skillsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Skill[];
      
      setSkills(skillsData.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAddSkill = () => {
    setEditingSkill(null);
    setFormData({ name: '', description: '' });
    setShowAddForm(true);
  };

  const handleEditSkill = (skill: Skill) => {
    setEditingSkill(skill);
    setFormData({ name: skill.name, description: skill.description || '' });
    setShowAddForm(true);
  };

  const handleSaveSkill = async () => {
    if (!currentUser || !formData.name.trim()) return;

    setSaving(true);
    try {
      const skillData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        createdAt: editingSkill ? editingSkill.createdAt : Timestamp.fromDate(new Date()),
        createdBy: editingSkill ? editingSkill.createdBy : currentUser.uid,
        createdByName: editingSkill ? editingSkill.createdByName : currentUser.fullname,
        updatedAt: Timestamp.fromDate(new Date()),
        updatedBy: currentUser.uid,
        updatedByName: currentUser.fullname
      };

      const skillId = editingSkill ? editingSkill.id : `skill_${Date.now()}`;
      await setDoc(doc(db, 'skills', skillId), skillData);

      setShowAddForm(false);
      setEditingSkill(null);
      setFormData({ name: '', description: '' });
    } catch (error) {
      console.error('Error saving skill:', error);
      alert('Gagal menyimpan kemahiran. Sila cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSkill = async (skillId: string, skillName: string) => {
    if (!confirm(`Adakah anda pasti ingin memadam kemahiran "${skillName}"? Tindakan ini tidak boleh dibatalkan.`)) {
      return;
    }

    try {
      // Check if skill is being used by any users
      const userSkillsSnapshot = await getDocs(query(collection(db, 'userSkills')));
      const usersWithSkill = userSkillsSnapshot.docs.filter(doc => 
        doc.data().skillId === skillId
      );

      if (usersWithSkill.length > 0) {
        alert(`Kemahiran ini tidak boleh dihapus kerana masih digunakan oleh ${usersWithSkill.length} pengguna. Sila minta mereka mengeluarkan kemahiran ini terlebih dahulu.`);
        return;
      }

      await deleteDoc(doc(db, 'skills', skillId));
    } catch (error) {
      console.error('Error deleting skill:', error);
      alert('Gagal memadam kemahiran. Sila cuba lagi.');
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingSkill(null);
    setFormData({ name: '', description: '' });
  };

  const filteredSkills = skills.filter(skill => 
    skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pengurusan Kemahiran</h1>
          <p className="text-gray-600 mt-2">Urus kemahiran yang tersedia dalam sistem</p>
        </div>
        <Button onClick={handleAddSkill} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Kemahiran
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                <Award className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Jumlah Kemahiran</p>
                <p className="text-2xl font-bold text-gray-900">{skills.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari kemahiran..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingSkill ? 'Edit Kemahiran' : 'Tambah Kemahiran Baru'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Kemahiran *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Contoh: Suntingan Video, Pereka Grafik"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Penerangan (Opsional)
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Penerangan ringkas tentang kemahiran ini"
                  className="w-full"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={handleSaveSkill}
                  disabled={saving || !formData.name.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Menyimpan...' : (editingSkill ? 'Kemas kini' : 'Simpan')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Batal
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills List */}
      <div className="space-y-4">
        {filteredSkills.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Award className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchTerm 
                  ? `Tiada kemahiran dijumpai untuk "${searchTerm}"` 
                  : 'Tiada kemahiran ditambah lagi'
                }
              </p>
              {!searchTerm && (
                <Button onClick={handleAddSkill} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Kemahiran Pertama
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredSkills.map((skill) => (
            <Card key={skill.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge variant="secondary" className="text-sm">
                        {skill.name}
                      </Badge>
                    </div>
                    
                    {skill.description && (
                      <p className="text-gray-700 mb-3">{skill.description}</p>
                    )}
                    
                    <div className="text-sm text-gray-600">
                      <p>Dibuat oleh {skill.createdByName} pada {formatDate(skill.createdAt)}</p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditSkill(skill)}
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteSkill(skill.id, skill.name)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Hapus
                    </Button>
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