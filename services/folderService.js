import supabase from '../config/supabase.js';

// Create folder
export const createFolder = async (userId, name, color = '#E9D5FF', emoji = '📁') => {
    const { data, error } = await supabase
        .from('folders')
        .insert({
            user_id: userId,
            name,
            color,
            emoji,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Get user's folders
export const getUserFolders = async (userId) => {
    const { data, error } = await supabase
        .from('folders')
        .select(`
      *,
      topics:topics(count)
    `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to include topic count
    return data.map(folder => ({
        ...folder,
        topicCount: folder.topics?.[0]?.count || 0,
        topics: undefined // Remove the topics array
    }));
};

// Get folder by ID
export const getFolderById = async (folderId) => {
    const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('id', folderId)
        .single();

    if (error) throw error;
    return data;
};

// Update folder
export const updateFolder = async (folderId, updates) => {
    const { data, error } = await supabase
        .from('folders')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', folderId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Delete folder (topics remain, folder_id set to NULL)
export const deleteFolder = async (folderId) => {
    const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

    if (error) throw error;
};

// Get topics in folder
export const getFolderTopics = async (folderId, userId) => {
    const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('folder_id', folderId)
        .eq('userId', userId)
        .order('createdAt', { ascending: false });

    if (error) throw error;
    return data;
};

// Update topic's folder
export const updateTopicFolder = async (topicId, folderId) => {
    const { data, error } = await supabase
        .from('topics')
        .update({
            folder_id: folderId,
            updatedAt: new Date().toISOString()
        })
        .eq('id', topicId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Remove topic from folder
export const removeTopicFromFolder = async (topicId) => {
    const { data, error } = await supabase
        .from('topics')
        .update({
            folder_id: null,
            updatedAt: new Date().toISOString()
        })
        .eq('id', topicId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export default {
    createFolder,
    getUserFolders,
    getFolderById,
    updateFolder,
    deleteFolder,
    getFolderTopics,
    updateTopicFolder,
    removeTopicFromFolder
};
