export const WEEKDAYS=['MO','TU','WE','TH','FR','SA','SU'];
const TYPES=['lesson','advertisement','series-part'];

function dateValue(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value??''))throw Error('Expected YYYY-MM-DD date');
  const date=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)throw Error('Invalid calendar date '+value);
  return date;
}
export function addCalendarDays(value,days) {
  const date=dateValue(value);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
export function calendarWeekday(value) {return WEEKDAYS[(dateValue(value).getUTCDay()+6)%7];}
export function contentTypeOf(item) {return item.contentType??(item.series?'series-part':'lesson');}

export function validateWeeklySchedule(calendar) {
  const policy=calendar?.weeklySchedule;
  if(policy===undefined)return []; // Historical calendars keep their existing cadence.
  const errors=[];
  try{dateValue(policy.effectiveFromDate);}catch(error){errors.push(error.message);}
  const days=policy.days;
  if(policy.schemaVersion!==1 || !Array.isArray(days) || days.length!==WEEKDAYS.length ||
      new Set(days.map(day=>day?.weekday)).size!==WEEKDAYS.length ||
      days.some(day=>!WEEKDAYS.includes(day?.weekday)||!TYPES.includes(day?.contentType)))
    return [...errors,'weeklySchedule must assign one supported content type to every weekday'];
  if(calendar.cadencePerWeek!==days.length || !Array.isArray(calendar.planningWeekdays) ||
      calendar.planningWeekdays.length!==days.length || new Set(calendar.planningWeekdays).size!==days.length ||
      days.some(day=>!calendar.planningWeekdays.includes(day.weekday)))
    errors.push('cadencePerWeek and planningWeekdays must match weeklySchedule');
  const series=days.filter(day=>day.contentType==='series-part').sort((a,b)=>a.part-b.part);
  if(series.length && (series.length<2 || series.some((day,index)=>day.part!==index+1 ||
      (index && (WEEKDAYS.indexOf(day.weekday)-WEEKDAYS.indexOf(series[index-1].weekday)+7)%7!==1))))
    errors.push('weekly series parts must be ordered, unique and on consecutive days');
  if(days.some(day=>day.contentType!=='series-part' && day.part!==undefined))errors.push('Only a series slot can carry a part number');
  return errors;
}

export function expectedContentSlot(calendar,date) {
  dateValue(date);
  const policy=calendar.weeklySchedule;
  if(!policy || date<policy.effectiveFromDate)return null;
  const weekday=calendarWeekday(date),day=policy.days.find(item=>item.weekday===weekday);
  if(!day)throw Error('Missing weekday in weeklySchedule');
  const series=day.contentType==='series-part'?{
    part:day.part,totalParts:policy.days.filter(item=>item.contentType==='series-part').length,
    startDate:addCalendarDays(date,1-day.part),
  }:undefined;
  return {date,weekday,contentType:day.contentType,...(series?{series}:{})};
}

export function validateScheduledContent(calendar) {
  const errors=validateWeeklySchedule(calendar);
  if(errors.length || !calendar?.weeklySchedule)return errors;
  for(const item of calendar.items??[]) {
    let slot;
    try{slot=expectedContentSlot(calendar,item.date);}catch(error){errors.push(error.message);continue;}
    if(!slot)continue;
    if(contentTypeOf(item)!==slot.contentType)errors.push(`${item.id}: ${item.date} requires ${slot.contentType}, not ${contentTypeOf(item)}`);
    if(slot.contentType==='advertisement') {
      if(item.promoFile!==`promos/${item.id}.json` || item.episodeFile || item.series)
        errors.push(`${item.id}: advertisement must reference its complete promo draft, not an episode`);
    } else {
      if(item.episodeFile!==`episodes/${item.id}.json` || item.promoFile)
        errors.push(`${item.id}: lesson/series slot must reference its complete episode draft`);
      if(slot.series && (!item.series || item.series.part!==slot.series.part || item.series.totalParts!==slot.series.totalParts))
        errors.push(`${item.id}: series metadata must match the weekly part and complete set`);
    }
  }
  return errors;
}

/** Future source slots only. Extend the horizon to finish the last serial set. */
export function futureContentSlots(calendar,{today,count}={}) {
  const errors=validateWeeklySchedule(calendar);
  if(errors.length)throw Error(errors.join('\n'));
  if(!calendar.weeklySchedule)throw Error('Missing weeklySchedule');
  if(!Number.isSafeInteger(count)||count<1||count>366)throw Error('Expected 1–366 future slots');
  let date=addCalendarDays(today,1);
  if(date<calendar.weeklySchedule.effectiveFromDate)date=calendar.weeklySchedule.effectiveFromDate;
  const slots=[];
  do {
    slots.push(expectedContentSlot(calendar,date));
    date=addCalendarDays(date,1);
  } while(slots.length<count || (slots.at(-1).series && slots.at(-1).series.part<slots.at(-1).series.totalParts));
  return slots;
}

export function weeklyCoverage(calendar,{today,count,itemIsReady=()=>true}={}) {
  const errors=validateScheduledContent(calendar);
  if(errors.length)throw Error(errors.join('\n'));
  const cache=new Map();
  const inspect=item=>{
    if(!cache.has(item.id)) {
      const result=itemIsReady(item);
      cache.set(item.id,typeof result==='boolean'?{ready:result}:result);
    }
    return cache.get(item.id);
  };
  return futureContentSlots(calendar,{today,count}).map(slot=>{
    const item=calendar.items.find(item=>item.date===slot.date);
    const start=slot.series && calendar.items.find(item=>item.date===slot.series.startDate);
    const pastStartMissing=slot.series && slot.series.startDate<=today &&
      (!start?.series || start.series.part!==1 || start.series.id!==item?.series?.id);
    const groupIncomplete=item?.series && calendar.items.some(peer=>peer.series?.id===item.series.id &&
      peer.status==='planned' && peer.date>today && !inspect(peer)?.ready);
    const ready=Boolean(item?.status==='planned' && !pastStartMissing && !groupIncomplete && inspect(item)?.ready);
    return {...slot,...(item?{item}:{}),ready,
      blocked:Boolean(pastStartMissing || (item && item.status!=='planned')),
      reason:ready?null:pastStartMissing?'preceding series part is missing; do not invent a past part':
        !item?'complete source draft and calendar entry are missing':
        item.status!=='planned'?'occupied non-planned item; preserve its status and history':
        groupIncomplete?'series draft set incomplete':inspect(item)?.reason??'source or required translations are not draft-ready'};
  });
}
