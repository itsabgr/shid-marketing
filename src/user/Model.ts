import {Collection, UpdateFilter} from "mongodb";


export enum Kind {
    Marketer = 'Marketer',
    Advertiser = 'Advertiser',
    Admin = 'Admin'
}

export class User {

    constructor(
        public id: string,
        public kind: Kind,
        public reg_at: Date = new Date(),
        public level?: string | null,
        public code?: string | null,
        public ban_at?: Date | null,
        public parent_id?: string | null
    ) {
    }

    static async findById(users: Collection, id: string): Promise<User> {
        if (typeof id !== 'string') {
            return this.fromObject(undefined)
        }
        const found = await users.findOne<User>({id})
        return User.fromObject(found)
    }

    static fromObject(o: any): User {
        if (!o || typeof o.id !== 'string') {
            throw new Error('user not exists')
        }
        return new User(o.id, o.kind, o.reg_at, o.level, o.code, o.ban_at, o.parent_id)
    }


    toObject() {
        return {
            id: this.id,
            ban_at: this.ban_at,
            code: this.code,
            kind: this.kind,
            level: this.level,
            reg_at: this.reg_at,
            parent_id: this.parent_id,
        }
    }

    static async purge(users: Collection, id: string) {
        await users.deleteOne({id})
    }

    async parent(users: Collection): Promise<User> {
        return User.findById(users, this.id)
    }

    createMarketer(id: string, level: string, code: string, parent?: string | null, reg_at = new Date()) {
        return new User(id, Kind.Marketer, reg_at, level, code, undefined, parent)
    }

    createAdvertiser(id: string, parent?: string | null, reg_at = new Date()) {
        return new User(id, Kind.Marketer, reg_at, undefined, undefined, undefined, parent)
    }

    ban(at = new Date()) {
        this.ban_at = at
    }

    unban() {
        this.ban_at = null
    }

    isBanned() {
        return !!this.ban_at
    }

    hasParent() {
        return !!this.parent_id
    }


    async update(users: Collection, upsert: false): Promise<User> {
        const $set = this.toObject() as any
        const $unset = {} as any
        for (const key in $set) {
            if ($set[key] == null) {
                $unset[key] = ''
                delete ($set[key])
            }
        }
        delete ($set.id)
        delete ($unset.id)
        const {value} = await users.findOneAndUpdate({id: this.id}, {$set, $unset}, {upsert})
        return User.fromObject(value)
    }
}

export default User