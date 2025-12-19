import React, { createContext, useContext, useState, useEffect } from "react";
import { getGroups, getGroupDetail, getGroupByCode } from "../services/groupService";

const GroupContext = createContext();

export const useGroup = () => {
    const context = useContext(GroupContext);
    // Return null context if not in provider (for admin routes)
    if (!context) {
        return {
            currentGroup: null,
            setCurrentGroup: () => { },
            isOnline: navigator.onLine,
            isGroupPanel: false,
            isGroupLoading: false,
        };
    }
    return context;
};

export const GroupProvider = ({ children }) => {
    const ACTIVE_GROUP_ID_KEY = "activeGroupId";
    const ACTIVE_GROUP_CODE_KEY = "activeGroupCode";
    const ACTIVE_GROUP_CACHE_KEY = "activeGroupCache";

    const mapGroupFromApi = (group) => {
        if (!group) return null;
        return {
            id: group._id,
            code: group.group_code,
            name: group.group_name,
            village: group.village,
            cluster: group.cluster || group.cluster_name,
            formationDate: group.formation_date,
            noMembers: group.no_members,
            memberCount: group.memberCount ?? group.no_members ?? 0,
            president: group.president_name,
            secretary: group.secretary_name,
            treasurer: group.treasurer_name,
            bank: group.bankmaster || null, // primary/latest bank
            banks: Array.isArray(group.banks) ? group.banks : [],
            raw: group,
        };
    };

    // In real app this should come from group-user login. For now we load one "active group"
    // from localStorage and fallback to first created group.
    const [currentGroup, _setCurrentGroup] = useState(null);
    const [isGroupLoading, setIsGroupLoading] = useState(true);

    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const setCurrentGroup = (group) => {
        _setCurrentGroup(group);
        try {
            if (group?.id) localStorage.setItem(ACTIVE_GROUP_ID_KEY, group.id);
            if (group?.code) localStorage.setItem(ACTIVE_GROUP_CODE_KEY, group.code);
            if (group) localStorage.setItem(ACTIVE_GROUP_CACHE_KEY, JSON.stringify(group));
        } catch {
            // ignore storage errors
        }
    };

    const loadActiveGroup = async () => {
        // If offline, try cached group
        if (!navigator.onLine) {
            try {
                const cached = localStorage.getItem(ACTIVE_GROUP_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    _setCurrentGroup(parsed);
                    return;
                }
            } catch {
                // ignore
            }
        }

        // Online: load from API
        const storedId = localStorage.getItem(ACTIVE_GROUP_ID_KEY);
        const storedCode = localStorage.getItem(ACTIVE_GROUP_CODE_KEY);

        // Prefer id, then code
        if (storedId) {
            const detailRes = await getGroupDetail(storedId);
            const group = mapGroupFromApi(detailRes?.data);
            if (group) {
                setCurrentGroup(group);
                return;
            }
        }

        if (storedCode) {
            const detailRes = await getGroupByCode(storedCode);
            const group = mapGroupFromApi(detailRes?.data);
            if (group) {
                setCurrentGroup(group);
                return;
            }
        }

        // Fallback: pick first group from list
        const listRes = await getGroups();
        const first = Array.isArray(listRes?.data) ? listRes.data[0] : null;
        if (!first?._id) {
            _setCurrentGroup(null);
            return;
        }
        const detailRes = await getGroupDetail(first._id);
        const group = mapGroupFromApi(detailRes?.data);
        setCurrentGroup(group);
    };

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    useEffect(() => {
        // Load group on mount
        setIsGroupLoading(true);
        loadActiveGroup()
            .catch((e) => {
                console.error("Failed to load active group:", e);
                _setCurrentGroup(null);
            })
            .finally(() => setIsGroupLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <GroupContext.Provider value={{ currentGroup, setCurrentGroup, isOnline, isGroupPanel: true, isGroupLoading }}>
            {children}
        </GroupContext.Provider>
    );
};

