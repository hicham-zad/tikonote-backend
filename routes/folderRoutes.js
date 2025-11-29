import express from 'express';
import {
    createFolder,
    getUserFolders,
    getFolder,
    updateFolder,
    deleteFolder,
    getFolderTopics,
    assignTopicToFolder
} from '../controllers/folderController.js';
import { authenticateUser } from '../middleware/supabaseAuth.js';


const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Folder CRUD
router.post('/', createFolder);
router.get('/', getUserFolders);
router.get('/:folderId', getFolder);
router.put('/:folderId', updateFolder);
router.delete('/:folderId', deleteFolder);

// Folder topics
router.get('/:folderId/topics', getFolderTopics);

// Assign topic to folder (also used in topicRoutes)
router.put('/topics/:topicId/folder', assignTopicToFolder);

export default router;
