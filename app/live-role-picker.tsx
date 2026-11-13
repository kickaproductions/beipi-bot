'use client';

type Role = { id: string; name: string; color: number };

export default function LiveRolePicker({
    roles, guildId, selected, onChange, disabled = false, everyoneControl = false,
}: {
    roles: Role[];
    guildId: string;
    selected: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
    everyoneControl?: boolean;
}) {
    const selectedRoles = selected.filter(id => id !== guildId);
    const toggle = (id: string, checked: boolean) =>
        onChange(checked ? [...new Set([...selectedRoles, id])] : selectedRoles.filter(value => value !== id));

    return (
        <fieldset className="live-role-picker" disabled={disabled}>
            <legend>Roles to notify <span>(optional)</span></legend>
            <p>Select as many roles as you want B.E.I.P.I. to mention.</p>
            {roles.length ? <div>{roles.map(role => {
                const isEveryone = role.id === guildId;
                const restriction = everyoneControl ? 'Use the @everyone setting above' : 'Unavailable for community alerts';
                return (
                    <label key={role.id}>
                        <input type="checkbox" disabled={isEveryone} checked={!isEveryone && selectedRoles.includes(role.id)} onChange={event => toggle(role.id, event.target.checked)}/>
                        <span className="live-role-colour" style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#8c7c96' }}/>
                        <strong>{isEveryone ? '@everyone' : '@' + role.name}</strong>
                        {isEveryone && <small>{restriction}</small>}
                    </label>
                );
            })}</div> : <small>No roles were found for this server.</small>}
            {selectedRoles.length > 0 && <small>{selectedRoles.length} {selectedRoles.length === 1 ? 'role' : 'roles'} selected</small>}
        </fieldset>
    );
}
