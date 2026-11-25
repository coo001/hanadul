# hanadul

Read numbers aloud in Korean.

Korean has two number systems, and which one you use depends on what you are
counting: `3시 15분` is read "세 시 십오 분" (native for the hour, Sino-Korean
for the minutes). hanadul ("하나, 둘" = "one, two") turns digits into the words
a person would actually say, so learners can check themselves.

I'm building it during the [Qodo Software Factory Hackathon](https://hackathon.qodo.ai/).
Coding agents write the code from tickets, and Qodo reviews each pull request
before I merge it.

## Status

Sino-Korean readings for 0 to 9999 work, from code and from the command line:

    $ node bin/hanadul.js 1234
    천이백삼십사

A leading 1 is silent before 십, 백 and 천, so 10 is "십" and 1100 is "천백".

## Planned

- Sino-Korean and native Korean numerals
- Counters (시, 분, 개, 명, 살 ...), which pick the right system
- Times, dates, money and phone numbers
- A web page that works offline, with a quiz mode

## Run

Node 22 or newer. No dependencies.

    npm test
