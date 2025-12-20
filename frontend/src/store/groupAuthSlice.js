import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  token: localStorage.getItem("groupToken") || null,
  group: JSON.parse(localStorage.getItem("groupData") || "null"),
  isAuthenticated: !!localStorage.getItem("groupToken"),
};

const groupAuthSlice = createSlice({
  name: "groupAuth",
  initialState,
  reducers: {
    setGroupCredentials: (state, action) => {
      const { token, group } = action.payload;
      state.token = token;
      state.group = group;
      state.isAuthenticated = true;
      
      // Persist to localStorage
      localStorage.setItem("groupToken", token);
      localStorage.setItem("groupData", JSON.stringify(group));
      
      // Also set for GroupContext compatibility
      if (group?.id) localStorage.setItem("activeGroupId", group.id);
      if (group?.code) localStorage.setItem("activeGroupCode", group.code);
      if (group) localStorage.setItem("activeGroupCache", JSON.stringify(group));
    },
    updateGroup: (state, action) => {
      state.group = { ...state.group, ...action.payload };
      localStorage.setItem("groupData", JSON.stringify(state.group));
      
      // Update cache as well
      if (state.group) {
        localStorage.setItem("activeGroupCache", JSON.stringify(state.group));
      }
    },
    logoutGroup: (state) => {
      state.token = null;
      state.group = null;
      state.isAuthenticated = false;
      
      // Clear localStorage
      localStorage.removeItem("groupToken");
      localStorage.removeItem("groupData");
      localStorage.removeItem("activeGroupId");
      localStorage.removeItem("activeGroupCode");
      localStorage.removeItem("activeGroupCache");
    },
  },
});

export const { setGroupCredentials, updateGroup, logoutGroup } = groupAuthSlice.actions;

// Selectors
export const selectGroupToken = (state) => state.groupAuth.token;
export const selectGroup = (state) => state.groupAuth.group;
export const selectIsGroupAuthenticated = (state) => state.groupAuth.isAuthenticated;

export default groupAuthSlice.reducer;

