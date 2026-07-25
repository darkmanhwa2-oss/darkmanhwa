/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Client-side API Helpers

const getToken = () => localStorage.getItem('dark_watch_token');

export const apiFetch = async (endpoint: string, options: RequestInit & { silent?: boolean } = {}) => {
  const token = getToken();
  const { silent, ...fetchOptions } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...fetchOptions,
      headers,
    });
  } catch (networkErr: any) {
    if (!silent) {
      console.error(`[Network Error] Request failed on ${endpoint}:`, networkErr);
    }
    throw new Error('فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت ومحاولة إعادة تحميل الصفحة.');
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('dark_watch_token');
      window.dispatchEvent(new CustomEvent('dark_watch_auth_expired'));
    }

    let errorData: any = {};
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      errorData = await response.json().catch(() => ({}));
    } else {
      const rawText = await response.text().catch(() => '');
      errorData = { message: rawText ? `خطأ الخادم (${response.status}): ${rawText.substring(0, 80)}` : undefined };
    }
    
    const errMsg = errorData.message || `حدث خطأ غير متوقع أثناء الاتصال بالخادم (رمز الحالة: ${response.status})`;
    console.error(`[API Error] Request to ${endpoint} failed with status ${response.status}:`, errMsg);
    throw new Error(errMsg);
  }

  return response.json();
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};
