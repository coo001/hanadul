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

Sino-Korean readings work from 0 to 9999조 9999억 9999만 9999, from code and
from the command line:

    $ node bin/hanadul.js 1234
    천이백삼십사
    $ node bin/hanadul.js 12345678
    천이백삼십사만 오천육백칠십팔

A leading 1 is silent before 십, 백, 천 and 만, so 10 is "십" and 10000 is "만".
억 and 조 keep it: 100000000 is "일억". Groups of four digits are separated by a
space, the way the Korean spelling rules write them.

Native Korean numerals work from 1 to 99 in code (`readNative` in
`src/native.js`): 21 is "스물하나". There is no native zero, and from 100 up
Korean uses Sino-Korean, so those throw.

## Planned

- Sino-Korean and native Korean numerals
- Counters (시, 분, 개, 명, 살 ...), which pick the right system
- Times, dates, money and phone numbers
- A web page that works offline, with a quiz mode

## Run

Node 22 or newer. No dependencies.

    npm test
