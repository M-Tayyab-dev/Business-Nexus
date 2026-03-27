import express from 'express';
import * as documentController from '../controllers/documentController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { rateLimiters } from '../middleware/security.js';
import { upload } from '../controllers/documentController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Document upload and management
router.post('/', 
  rateLimiters.upload,
  upload.single('file'),
  validate(schemas.uploadDocument),
  documentController.uploadDocument
);

router.get('/', 
  rateLimiters.general,
  documentController.getMyDocuments
);

router.get('/stats', 
  rateLimiters.general,
  documentController.getDocumentStats
);

router.get('/:id', 
  rateLimiters.general,
  documentController.getDocument
);

router.get('/:id/versions', 
  rateLimiters.general,
  documentController.getDocumentVersions
);

router.get('/:id/download', 
  rateLimiters.general,
  documentController.downloadDocument
);

router.put('/:id', 
  rateLimiters.general,
  validate(schemas.updateDocument),
  documentController.updateDocument
);

router.delete('/:id', 
  rateLimiters.general,
  documentController.deleteDocument
);

// Document sharing
router.post('/:id/share', 
  rateLimiters.general,
  validate(schemas.shareDocument),
  documentController.shareDocument
);

// Document signatures
router.post('/:id/signatures/request', 
  rateLimiters.general,
  validate(schemas.searchQuery), // Reusing for userId validation
  documentController.requestSignature
);

router.post('/:id/sign', 
  rateLimiters.general,
  validate(schemas.signDocument),
  documentController.signDocument
);

export default router;
