import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DocumentDashboard from './pages/DocumentDashboard';
import DocumentUpload from './pages/DocumentUpload';
import DocumentDetail from './pages/DocumentDetail';
import DocumentEdit from './pages/DocumentEdit';

function DocumentLibraryPage() {
  return (
    <Routes>
      <Route index element={<DocumentDashboard />} />
      <Route path="upload" element={<DocumentUpload />} />
      <Route path="doc/:id" element={<DocumentDetail />} />
      <Route path="edit/:id" element={<DocumentEdit />} />
      <Route path="*" element={<Navigate to="/document-library" replace />} />
    </Routes>
  );
}

export default DocumentLibraryPage;
