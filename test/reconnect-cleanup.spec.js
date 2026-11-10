"use strict"

const assert = require("node:assert/strict")
const { CommonClient } = require("../dist/index.cjs")

const createClient = () =>
{
    const sockets = []
    const factory = () =>
    {
        const listeners = new Map()
        const socket = {
            addEventListener: (event, callback) => listeners.set(event, callback),
            close: () => listeners.get("close")?.({ code: 1000 }),
            emit: (event, data) => listeners.get(event)?.(data),
        }
        sockets.push(socket)
        return socket
    }
    const client = new CommonClient(factory, "ws://localhost", {
        autoconnect: false, reconnect: true, reconnect_interval: 10,
    })
    client.connect()
    sockets[0].emit("open")
    sockets[0].emit("close", { code: 1006 })
    return { client, sockets }
}

describe("Client reconnect cleanup", () =>
{
    for (const action of ["close", "disable reconnect"])
        it(`cancels the scheduled reconnect on ${action}`, async () =>
        {
            const { client, sockets } = createClient()
            assert.equal(client.isReconnecting(), true)
            if (action === "close") client.close()
            else client.setAutoReconnect(false)
            assert.equal(client.isReconnecting(), false)
            await new Promise((resolve) => setTimeout(resolve, 30))
            assert.equal(sockets.length, 1)
        })

    it("retains automatic reconnect when it has not been canceled", async () =>
    {
        const { client, sockets } = createClient()
        await new Promise((resolve) => setTimeout(resolve, 30))
        assert.equal(sockets.length, 2)
        assert.equal(client.isReconnecting(), false)
        client.setAutoReconnect(false)
        client.close()
    })

    it("cancels the pending timer when connecting manually", async () =>
    {
        const { client, sockets } = createClient()
        client.connect()
        assert.equal(sockets.length, 2)
        assert.equal(client.isReconnecting(), false)
        await new Promise((resolve) => setTimeout(resolve, 30))
        assert.equal(sockets.length, 2)
        client.close()
    })

    it("can reconnect after automatic reconnect is enabled again", async () =>
    {
        const { client, sockets } = createClient()
        client.setAutoReconnect(false)
        client.connect()
        sockets[1].emit("open")
        client.setAutoReconnect(true)
        sockets[1].emit("close", { code: 1006 })
        assert.equal(client.isReconnecting(), true)
        await new Promise((resolve) => setTimeout(resolve, 30))
        assert.equal(sockets.length, 3)
        assert.equal(client.isReconnecting(), false)
        client.close()
    })
})
