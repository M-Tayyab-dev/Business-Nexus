import { apiClient } from './client';

export const documentsApi = {
  // Upload a file to Cloudinary / storage via Multer on backend
  uploadDocument: (formData: FormData) => apiClient.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' } // Must overwrite application/json headers for this request
  }),
  
  // List documents owned or shared with the user
  getMyDocuments: (params?: any) => apiClient.get('/documents', { params }),
  
  // Full metadata of an individual document
  getDocument: (id: string) => apiClient.get(`/documents/${id}`),
  
  // Update document properties
  updateDocument: (id: string, data: any) => apiClient.put(`/documents/${id}`, data),
  
  // Remove document entirely from the scope
  deleteDocument: (id: string) => apiClient.delete(`/documents/${id}`),
  
  shareDocument: (id: string, users: string[]) => apiClient.post(`/documents/${id}/share`, { users }),
  
  // e-Signature flows
  requestSignature: (id: string, signers: string[]) => apiClient.post(`/documents/${id}/signatures/request`, { signers }),
  
  // Submit an e-signature string/image for the document
  signDocument: (id: string, signatureData: { signature: string; comments?: string; position: any }) => 
    apiClient.post(`/documents/${id}/sign`, signatureData),
    
  // Versioning 
  getDocumentVersions: (id: string) => apiClient.get(`/documents/${id}/versions`),
  
  // Streaming download of the file
  downloadDocument: (id: string) => apiClient.get(`/documents/${id}/download`, { responseType: 'blob' }),
  
  getDocumentStats: () => apiClient.get('/documents/stats'),
};
