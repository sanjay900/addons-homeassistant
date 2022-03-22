import fetch from 'node-fetch';
import fs from 'fs'
import { Worker, isMainThread, parentPort } from 'worker_threads'

const options = JSON.parse(fs.readFileSync('/data/options.json'));
let api_key = options.api_key
let creds = options.logins
let urls = options.urls
for (let cred of creds) {
    for (let url of urls) {
        if (cred.club == url.name) {
            if (!url.username_url) {
                url.username_url = cred.username
                url.password_url = cred.password
            }
        } 
    }
}
if (isMainThread) {
    
    // List events 
    let worker = new Worker("./index.js");
    let test = async () => {
        console.log("Checking for new events");
        try {
            let from = new Date()
            from = from.toISOString().split('T')[0].replace(/-/g, '/');
            let to = new Date();
            to.setDate(to.getDate() + 4);
            to = to.toISOString().split('T')[0].replace(/-/g, '/');
            for (let {url, club_id, username_url, password_url, name} of urls) {
                let headers_url = { 'Authorization': 'Basic ' + Buffer.from(username_url + ":" + password_url).toString('base64') }
                let events = await fetch(`${url}/api/v0/club/${club_id}/event/${from}/to/${to}/&api_key=${api_key}`, {
                    method: 'GET',
                    headers: headers_url
                });
                events = await events.json();
                if (events.statuscode > 200) {
                    console.log(events)
                    continue
                }
                for (let {username, password, schedule_id, activity_id, hour, min, days, club} of creds) {
                    let headers = { 'Authorization': 'Basic ' + Buffer.from(username + ":" + password).toString('base64') }
                    for (let event of events.result) {
                        if (name == club && event.schedule_id == schedule_id && event.activity_id == activity_id) {
                            let time = new Date(event.event_start * 1000);
                            if (hour == time.getHours() && min == time.getMinutes() && days.includes(time.getDay())) {
                                if (event.joinable) {
                                    worker.postMessage({ headers, event, club_id, url, username });
                                }
                            }
                        }
                    }
                }
            }
        } catch (ex) {
            console.error(ex)
        }
    }
    setInterval(test, 20 * 1000);
    test()
} else {
    let bookedEvents = {};
    let alreadyBooked = new Set();
    parentPort.on('message', event => {
        bookedEvents[event.event.event_id + event.username] = event;
    })
    let test = async () => {
        try {
            for (let id of Object.keys(bookedEvents)) {
                if (alreadyBooked.has(id)) continue;
                let { headers, event, club_id, url, username } = bookedEvents[id];
                let time = new Date(event.event_start * 1000);
                if (new Date().getTime() / 1000 > event.bookable_from_timestamp) {
                    console.log(`Booking slot: ${time.toLocaleString()} ${username} ${event.event_id}`)
                    let out = await fetch(`${url}/api/v0/club/${club_id}/event/${event.event_id}/join&api_key=${api_key}`, {
                        method: 'POST',
                        body: JSON.stringify({ send_email: false, reason: "" }),
                        headers
                    });
                    out = await out.json();
                    console.log("Result:");
                    console.log(out);
                    alreadyBooked.add(id);
                }
            }
        } catch (ex) {
            console.error(ex)
        }
        setTimeout(test, 1);
    }
    test();
}
