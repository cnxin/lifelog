import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (error) {
    console.error('请求通知权限失败:', error);
    return false;
  }
}

/**
 * 检查通知权限
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  } catch (error) {
    console.error('检查通知权限失败:', error);
    return false;
  }
}
