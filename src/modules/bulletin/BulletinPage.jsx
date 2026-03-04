import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BulletinDashboard from './pages/BulletinDashboard';
import PostWrite from './pages/PostWrite';
import PostDetail from './pages/PostDetail';
import PostEdit from './pages/PostEdit';

function BulletinPage({ boardType = 'directive' }) {
  const basePath = boardType === 'communication' ? '/communication' : '/bulletin';

  return (
    <Routes>
      <Route index element={<BulletinDashboard boardType={boardType} />} />
      <Route path="write" element={<PostWrite boardType={boardType} />} />
      <Route path="post/:id" element={<PostDetail boardType={boardType} />} />
      <Route path="edit/:id" element={<PostEdit boardType={boardType} />} />
      <Route path="*" element={<Navigate to={basePath} replace />} />
    </Routes>
  );
}

export default BulletinPage;
