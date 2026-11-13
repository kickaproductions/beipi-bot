export const dashboardPaths = {
    Home: '/dashboard',
    Reminders: '/reminders',
    'My Stream': '/mystream',
    'Idea pocket': '/ideas',
    'Discord setup': '/discord-setup',
    Connections: '/connections',
    'My Crew': '/mycrew',
    'Account settings': '/settings',
} as const;

export type DashboardView = keyof typeof dashboardPaths;

export function dashboardViewFromPath(path: string) {
    return (Object.keys(dashboardPaths) as DashboardView[])
        .find(view => dashboardPaths[view] === path);
}
