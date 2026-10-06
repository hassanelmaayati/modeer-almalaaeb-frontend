/** @typedef {{ signal?: AbortSignal }} RequestOptions */
/** @typedef {{ id: number, user_name: string, photo_url: string|null, bio: string|null, district: string|null, created_at?: string|null }} User */
/** Returned only to its owner (auth responses, /users/me, Google link). @typedef {User & { email: string, google_linked: boolean }} PrivateUser */
/** @typedef {{ token: string, msg: string, user: PrivateUser }} AuthResponse */
/** @typedef {{ user_name: string, email: string, password: string, photo_url?: string|null, bio?: string|null, district?: string|null }} SignupInput */
/** @typedef {{ email: string, password: string }} LoginInput */
/** @typedef {{ user_name: string, photo_url?: string|null, bio?: string|null, district?: string|null }} UserUpdate */
/** @typedef {{ key: string, capacity: number }} SportFormat */
/** formats are room size presets; cup_format is the cup type (null: no cups). @typedef {{ id: number, name: string, formats: SportFormat[]|null, cup_format: 'knockout'|'race'|null }} Sport */
/** @typedef {{ id: number, owner_id: number, name: string, sports_id: number, description: string|null, photo_url: string|null }} Group */
/** @typedef {{ name: string, sports_id: number, description?: string|null, photo_url?: string|null }} GroupInput */
/** @typedef {{ name: string, description?: string|null, photo_url?: string|null }} GroupUpdate */
/** @typedef {'pending'|'accepted'|'declined'|'left'|'removed'} MembershipStatus */
/** @typedef {{ id: number, user_id: number, status: MembershipStatus, room_id?: number|null, group_id?: number|null, cup_id?: number|null, other_user_id?: number|null, requested?: boolean|null, accepted?: boolean|null, position?: string|null, attendance?: string|null, rating?: number|null, user_blocked_other?: string|null, other_blocked_user?: string|null }} Membership */
/** @typedef {{ status: MembershipStatus }} MembershipUpdate */
/** @typedef {{ sport_id?: number, difficulty?: string, district?: string, starts_from?: string|Date, starts_to?: string|Date }} RoomQuery */
/** @typedef {{ status?: string|string[], sport_id?: number, visibility?: string, difficulty?: string, starts_from?: string|Date, starts_to?: string|Date, order?: 'asc'|'desc', limit?: number, offset?: number }} MyRoomsQuery */
/** @typedef {{ latitude: number, longitude: number }} VenueLocation */
/** @typedef {{ id: number, host_id: number, sport_id: number, group_id: number|null, title: string, description: string|null, notes: string|null, difficulty: string, starts_at: string, ends_at: string, capacity: number, slots_left: number, slot_layout: object, status: string, visibility: string, admission_policy: string, cancellation_reason: string|null, cancelled_at: string|null, district: string, area: string, distance_km: number|null, pace_notes: string|null, route_notes: string|null, host_generation: number, revision: number, venue_notes?: string|null, venue_location?: VenueLocation|null }} Room */
/** @typedef {{ sport_id: number, title: string, starts_at: string, ends_at: string, capacity: number, district: string, area: string, group_id?: number|null, description?: string|null, notes?: string|null, difficulty?: string, slot_layout?: object, visibility?: string, admission_policy?: string, venue_notes?: string|null, venue_location?: VenueLocation|null, distance_km?: number|null, pace_notes?: string|null, route_notes?: string|null }} RoomInput */
/** @typedef {Partial<RoomInput> & { revision: number }} RoomUpdate */
/** @typedef {{ items: Room[], total: number, limit: number, offset: number, has_more: boolean }} MyRoomsPage */
/** @typedef {MyRoomsQuery & { membership?: MembershipStatus|MembershipStatus[], requested?: boolean }} JoinedRoomsQuery */
/** @typedef {{ status: MembershipStatus, requested: boolean|null, position: string|null, attendance: string|null }} JoinedMembership */
/** @typedef {Room & { membership: JoinedMembership }} JoinedRoom */
/** @typedef {{ items: JoinedRoom[], total: number, limit: number, offset: number, has_more: boolean }} JoinedRoomsPage */
/** @typedef {{ status?: MembershipStatus, position?: string|null, attendance?: 'unknown'|'present'|'no_show'|'excused', rating?: number }} RoomMemberUpdate */
/** @typedef {{ status?: string, user_blocked_other?: string|null, other_blocked_user?: string|null }} FriendUpdate */
/** @typedef {{ id: number, sender_id: number|null, recipient_id: number|null, room_id: number|null, group_id: number|null, type: string, body: string, client_request_id: string|null, created_at: string|null }} Message */
/** @typedef {{ type: 'room'|'group'|'direct', room_id?: number|null, group_id?: number|null, user_id?: number|null, title: string, last_message: Message|null }} Conversation */
/** @typedef {{ room_id?: number, user_id?: number, group_id?: number, before?: number, limit?: number }} MessageQuery */
/** @typedef {{ room_id?: number, group_id?: number, recipient_id?: number, body: string, client_request_id: string }} MessageInput */
/** @typedef {{ id: number, kind: string, target: {type:'room'|'group'|'direct'|'cup',id:number}, text:string, read_at:string|null, created_at:string }} Notification */
/** @typedef {{ group_id: number, group_name: string, owner_user_id: number, status: string, entered_at: string, finish_time_seconds?: number|null, position?: number|null, did_not_finish?: boolean }} CupEntry */
/** @typedef {{ id: string, round: number, match: number, home_group_id?: number|null, away_group_id?: number|null, home_score?: number|null, away_score?: number|null, winner_group_id?: number|null }} CupFixture */
/** @typedef {{ id: number, organizer_user_id: number, organizer: User, sport_id: number, format: string|null, name: string, rules: string, team_count: number, roster_limit: number, status: string, registration_closes_at: string|null, rosters_locked_at: string|null, entries: CupEntry[], fixtures: CupFixture[], revision: number, created_at: string|null }} Cup */
/** @typedef {{ sport_id: number, name: string, rules: string, team_count: number, roster_limit: number, registration_closes_at?: string|null }} CupInput */
/** @typedef {{ fixture_id: string, home_score: number, away_score: number, winner_group_id?: number|null }} FixtureResult */
/** @typedef {{ group_id: number, finish_time_seconds?: number, position?: number, did_not_finish?: boolean }} RaceResult */
/** @typedef {Partial<Omit<CupInput, 'sport_id'>> & { status?: 'registration'|'published', result?: FixtureResult, race_results?: RaceResult[], revision?: number }} CupUpdate */
/** @typedef {{ group_id: number, revision?: number }} CupEntryInput */
/** @typedef {{ status: 'accepted'|'declined'|'withdrawn', revision?: number }} CupEntryUpdate */

export {};
