import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authAPI } from '../api';

interface User {
    id: number;
    email: string;
    created_at?: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}

const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
};

export const register = createAsyncThunk(
    'auth/register',
    async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
        try {
            const response = await authAPI.register(email, password);
            return response.data.user;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || '회원가입 실패');
        }
    }
);

export const login = createAsyncThunk(
    'auth/login',
    async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
        try {
            const response = await authAPI.login(email, password);
            return response.data.user;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || '로그인 실패');
        }
    }
);

export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
    try {
        await authAPI.logout();
    } catch (error: any) {
        return rejectWithValue(error.response?.data?.error || '로그아웃 실패');
    }
});

export const checkAuth = createAsyncThunk('auth/checkAuth', async (_, { rejectWithValue }) => {
    try {
        const response = await authAPI.getMe();
        return response.data.user;
    } catch (error: any) {
        return rejectWithValue(error.response?.data?.error || '인증 확인 실패');
    }
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            
            ///////////////////////     회원가입
            .addCase(register.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(register.fulfilled, (state, action: PayloadAction<User>) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.user = action.payload;
            })
            .addCase(register.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            ///////////////////////     로그인
            .addCase(login.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(login.fulfilled, (state, action: PayloadAction<User>) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.user = action.payload;
            })
            .addCase(login.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            ///////////////////////     로그아웃
            .addCase(logout.fulfilled, (state) => {
                state.isAuthenticated = false;
                state.user = null;
            })
            
            ///////////////////////     인증 관련된거
            .addCase(checkAuth.fulfilled, (state, action: PayloadAction<User>) => {
                state.isAuthenticated = true;
                state.user = action.payload;
            })
            .addCase(checkAuth.rejected, (state) => {
                state.isAuthenticated = false;
                state.user = null;
            });
    },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
