import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BulletinDashboard from './pages/BulletinDashboard';
import PostWrite from './pages/PostWrite';
import PostDetail from './pages/PostDetail';
import PostEdit from './pages/PostEdit';

function BulletinPage() {
  return (
    <Routes>
      <Route index element={<BulletinDashboard />} />
      <Route path="write" element={<PostWrite />} />
      <Route path="post/:id" element={<PostDetail />} />
      <Route path="edit/:id" element={<PostEdit />} />
      <Route path="*" element={<Navigate to="/bulletin" replace />} />
    </Routes>
  );
}

export default BulletinPage;
