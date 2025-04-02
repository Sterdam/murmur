import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchGroups = createAsyncThunk(
  'groups/fetchGroups',
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await api.get('/groups', {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch groups');
    }
  }
);

export const createGroup = createAsyncThunk(
  'groups/createGroup',
  async ({ name, members }, { rejectWithValue, getState }) => {
    try {
      const response = await api.post('/groups', { name, members }, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create group');
    }
  }
);

export const addGroupMembers = createAsyncThunk(
  'groups/addMembers',
  async ({ groupId, members }, { rejectWithValue, getState }) => {
    try {
      const response = await api.post(`/groups/${groupId}/members`, { members }, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add members');
    }
  }
);

export const removeGroupMember = createAsyncThunk(
  'groups/removeMember',
  async ({ groupId, memberId }, { rejectWithValue, getState }) => {
    try {
      const response = await api.delete(`/groups/${groupId}/members`, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
        data: { memberId },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to remove member');
    }
  }
);

export const updateGroup = createAsyncThunk(
  'groups/updateGroup',
  async ({ groupId, name, members }, { rejectWithValue, getState }) => {
    try {
      const response = await api.put(`/groups/${groupId}`, { name, members }, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update group');
    }
  }
);

export const leaveGroup = createAsyncThunk(
  'groups/leaveGroup',
  async (groupId, { rejectWithValue, getState }) => {
    try {
      const response = await api.post(`/groups/${groupId}/leave`, {}, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return groupId; // Return the groupId to remove it from state
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to leave group');
    }
  }
);

export const deleteGroup = createAsyncThunk(
  'groups/deleteGroup',
  async (groupId, { rejectWithValue, getState }) => {
    try {
      const response = await api.delete(`/groups/${groupId}`, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return groupId; // Return the groupId to remove it from state
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete group');
    }
  }
);

const initialState = {
  groups: [],
  loading: false,
  error: null,
};

const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Groups
      .addCase(fetchGroups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGroups.fulfilled, (state, action) => {
        state.loading = false;
        state.groups = action.payload;
      })
      .addCase(fetchGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create Group
      .addCase(createGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createGroup.fulfilled, (state, action) => {
        state.loading = false;
        state.groups.push(action.payload);
      })
      .addCase(createGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Add Members to Group
      .addCase(addGroupMembers.fulfilled, (state, action) => {
        const updatedGroup = action.payload;
        const index = state.groups.findIndex((group) => group.id === updatedGroup.id);
        
        if (index !== -1) {
          state.groups[index] = updatedGroup;
        }
      })
      // Remove Member from Group
      .addCase(removeGroupMember.fulfilled, (state, action) => {
        const updatedGroup = action.payload;
        const index = state.groups.findIndex((group) => group.id === updatedGroup.id);
        
        if (index !== -1) {
          state.groups[index] = updatedGroup;
        }
      })
      // Update Group
      .addCase(updateGroup.fulfilled, (state, action) => {
        const updatedGroup = action.payload;
        const index = state.groups.findIndex((group) => group.id === updatedGroup.id);
        
        if (index !== -1) {
          state.groups[index] = updatedGroup;
        }
      })
      // Leave Group
      .addCase(leaveGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(leaveGroup.fulfilled, (state, action) => {
        state.loading = false;
        state.groups = state.groups.filter(group => group.id !== action.payload);
      })
      .addCase(leaveGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete Group
      .addCase(deleteGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteGroup.fulfilled, (state, action) => {
        state.loading = false;
        state.groups = state.groups.filter(group => group.id !== action.payload);
      })
      .addCase(deleteGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = groupsSlice.actions;

export default groupsSlice.reducer;
