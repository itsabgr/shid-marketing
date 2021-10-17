import {Collection, ObjectId, Binary} from "mongodb";
import * as stream from 'stream'
import User from "../user/Model";

export class Blob {

    constructor(
        public _id: ObjectId,
        public length: number,
        public contentType: string,
        public owner_id: string,
        public uploadDate = new Date(),
    ) {
    }

    static async upload(meta: Collection, chunks: Collection, src: stream.Readable, contentType: string, owner_id: string, uploadDate = new Date()): Promise<Blob> {
        const files_id = new ObjectId()
        try {
            let length = 0
            let n = 0;
            for await (const chunk of src) {
                const data = new Binary(chunk)
                await chunks.insertOne({
                    data, files_id,
                    n: n++,
                    start: length,
                    end: length + data.length(),
                    length: data.length(),
                })
                length += data.length()
            }
            return new Blob(files_id, length, contentType, owner_id, uploadDate,)
        } catch (err) {
            await Blob.purge(meta, chunks, files_id)
            throw err
        }
    }

    static fromObject(o: any): Blob {
        if (!o || !(o._id instanceof ObjectId)) {
            throw new Error('blob not exists')
        }
        return new Blob(o._id, o.length, o.contentType, o.owner_id, o.uploadDate)
    }

    static async findById(meta: Collection, _id: ObjectId): Promise<Blob> {
        const found = await meta.findOne({_id})
        return Blob.fromObject(found)
    }

    static async purge(meta: Collection, chunks: Collection, _id: ObjectId) {
        await meta.deleteOne({_id})
        await chunks.deleteMany({files_id: _id})
    }

    owner(users: Collection) {
        return User.findById(users, this.owner_id)
    }

    async pipe(chunks: Collection, dst: stream.Writable, end = true, offset = -1) {
        const iter = this.iterateChunks(chunks, offset)
        for await(const chunk of iter) {
            dst.write(chunk, (err) => {
                if (err) {
                    iter.throw(err)
                }
            })
        }
        if (end) {
            dst.end()
        }
    }

    async* iterateChunks(chunks: Collection, offset = -1) {
        while (true) {
            const chunk = await chunks.findOne({files_id: this._id, n: {$gt: offset++}})
            if (!chunk) {
                return;
            }
            yield (chunk.data as Binary).buffer
        }
    }

}

export default Blob