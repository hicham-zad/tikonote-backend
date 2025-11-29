import folderService from '../services/folderService.js';

// Create folder
export const createFolder = async (req, res) => {
    try {
        const { name, color, emoji } = req.body;
        const userId = req.user.id;

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: 'Folder name is required'
            });
        }

        const folder = await folderService.createFolder(
            userId,
            name.trim(),
            color || '#E9D5FF',
            emoji || '📁'
        );

        res.status(201).json({
            success: true,
            folder
        });

    } catch (error) {
        console.error('❌ Create folder error:', error);

        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                error: 'A folder with this name already exists'
            });
        }

        res.status(500).json({ error: error.message });
    }
};

// Get user's folders
export const getUserFolders = async (req, res) => {
    try {
        const userId = req.user.id;

        const folders = await folderService.getUserFolders(userId);

        res.json({
            success: true,
            count: folders.length,
            folders
        });

    } catch (error) {
        console.error('❌ Get folders error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get folder by ID
export const getFolder = async (req, res) => {
    try {
        const { folderId } = req.params;
        const userId = req.user.id;

        const folder = await folderService.getFolderById(folderId);

        // Verify ownership
        if (folder.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json({
            success: true,
            folder
        });

    } catch (error) {
        console.error('❌ Get folder error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update folder
export const updateFolder = async (req, res) => {
    try {
        const { folderId } = req.params;
        const { name, color, emoji } = req.body;
        const userId = req.user.id;

        // Get folder to verify ownership
        const folder = await folderService.getFolderById(folderId);

        if (folder.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (color !== undefined) updates.color = color;
        if (emoji !== undefined) updates.emoji = emoji;

        const updatedFolder = await folderService.updateFolder(folderId, updates);

        res.json({
            success: true,
            folder: updatedFolder
        });

    } catch (error) {
        console.error('❌ Update folder error:', error);

        if (error.code === '23505') {
            return res.status(409).json({
                error: 'A folder with this name already exists'
            });
        }

        res.status(500).json({ error: error.message });
    }
};

// Delete folder
export const deleteFolder = async (req, res) => {
    try {
        const { folderId } = req.params;
        const userId = req.user.id;

        // Get folder to verify ownership
        const folder = await folderService.getFolderById(folderId);

        if (folder.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await folderService.deleteFolder(folderId);

        res.json({
            success: true,
            message: 'Folder deleted successfully'
        });

    } catch (error) {
        console.error('❌ Delete folder error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get topics in folder
export const getFolderTopics = async (req, res) => {
    try {
        const { folderId } = req.params;
        const userId = req.user.id;

        // Verify folder ownership
        const folder = await folderService.getFolderById(folderId);

        if (folder.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const topics = await folderService.getFolderTopics(folderId, userId);

        res.json({
            success: true,
            count: topics.length,
            topics
        });

    } catch (error) {
        console.error('❌ Get folder topics error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Assign topic to folder
export const assignTopicToFolder = async (req, res) => {
    try {
        const { topicId } = req.params;
        const { folderId } = req.body;
        const userId = req.user.id;

        // Get topic to verify ownership
        const { getTopicById } = await import('../services/supabaseService.js');
        const topic = await getTopicById(topicId);

        if (topic.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // If folderId is provided, verify folder ownership
        if (folderId) {
            const folder = await folderService.getFolderById(folderId);
            if (folder.user_id !== userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        // Update topic's folder
        const updatedTopic = folderId
            ? await folderService.updateTopicFolder(topicId, folderId)
            : await folderService.removeTopicFromFolder(topicId);

        res.json({
            success: true,
            topic: updatedTopic
        });

    } catch (error) {
        console.error('❌ Assign topic to folder error:', error);
        res.status(500).json({ error: error.message });
    }
};
