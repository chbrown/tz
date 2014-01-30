/*jslint browser: true, devel: true */ /*globals _, angular, moment */
var app = angular.module('app', ['ngStorage']);
var p = console.log.bind(console);

// app.filter('where', function() {
//   return _.where;
// });

// app.filter('encode', function() {
//   return window.encodeURIComponent;
// });

app.filter('trust', function($sce) {
  return function(string) {
    return $sce.trustAsHtml(string);
  };
});

app.controller('TimezoneCtrl', function($scope, $localStorage) {
  $scope.$storage = $localStorage.$default({
    timezone: 'UTC'
  });

  var refresh = function() {
    var local_offset_minutes = (new Date()).getTimezoneOffset();
    var local_offset_ms = local_offset_minutes * 60 * 1000;
    // utc = localTime + localOffset;
    var local_ms = (new Date()).getTime();
    var utc_ms = local_ms + local_offset_ms;
    // moment.tz(now, "America/Toronto").format();


    var destination_tz_tuple = _.find(tzdata, function(tz_tuple) {
      return tz_tuple[0] == $scope.$storage.timezone;
    });
    var destination_offset_ms = destination_tz_tuple[2] * 60 * 60 * 1000;
    p('destination_offset_ms', destination_offset_ms);
    var destination_ms = utc_ms - destination_offset_ms;

    $scope.start = moment(local_ms).format('MMMM Do YYYY, h:mm:ss a') + ' local';
    // $scope.end = moment(utc_ms).format('MMMM Do YYYY, h:mm:ss a') + ' UTC';
    $scope.end = moment(destination_ms).format('MMMM Do YYYY, h:mm:ss a') + ' ' + $scope.$storage.timezone;
  };
  refresh();

  $scope.$watch('$storage.timezone', function(new_value, old_value) {
    refresh();
  });

  setInterval(function() {
    $scope.$apply(refresh);
  }, 1000);

});

app.directive('map', function($localStorage, $http) {
  return {
    restrict: 'E',
    require: 'ngModel',
    link: function(scope, el, attrs, ngModel) {
      var ready = function() {
        var gs = el.find('g');
        gs.on('mouseover', function(ev) {
          var g = ev.target.parentNode;
          g.className = 'active';
          scope.$apply(function() {
            ngModel.$setViewValue(g.id);
          });
        });
        gs.on('mouseout', function(ev) {
          var g = ev.target.parentNode;
          g.className = '';
          p('mouseout', g);
          // scope.$apply(function() {
          //   ngModel.$setViewValue(g.id);
          // });
        });
      };

      if ($localStorage.svg) {
        el.ready(ready);
      }
      else {
        // go retrieve it if needed
        $http.get('static/zones.svg').then(function(res) {
          scope.svg = $localStorage.svg = res.data;
          el.ready(ready);
        }, function(res) {
          p('Error', res);
        });
      }

    }
  };
});



// var lookup = {};
// var timezones = timezone_tuples.map(function(tuple) { // [id, name, offset]
//   return lookup[tuple[0]] = new Timezone(tuple[0], tuple[1], tuple[2]);
// });

// all upper case since the input is converted to uppercase
// var timezone_abbreviation_regex = new RegExp('(' + _.pluck(timezones, 'id').join('|') + ')');
// var time_regex = /(\d{1,2})(:\d{2})?\s*([AP]M)?/;
// var total_regex = /^\s*(.*)\s+(IN|AS|AT|FOR|TO)\s+(.*)\s*$/;

function validateInput(input) {
  var now = new Date();
  var now_string = now.getHours() + ':' + now.getMinutes();
  input = input.toUpperCase().replace(/NOW/g, now_string).replace(/NOON/g, '12 pm').replace(/MIDNIGHT/g, '12 am');
  var full_match = input.match(total_regex);

  if (full_match) {
    var dest_tz_code = full_match[3],
        dest_tz = lookup[dest_tz_code];

    var src_str = full_match[1];
    var time_am_pm = src_str.match(time_regex);
    // to do: need to account for three digits (ie. 700 am)
    var src_tz_match = src_str.match(timezone_abbreviation_regex);
    var src_tz = src_tz_match && lookup[src_tz_match[0]];
    if (time_am_pm && src_tz && dest_tz) {
      $('#timezones').html(src_tz.name + ' <span class="conn">to</span> ' + dest_tz.name);
      // console.log(time_am_pm, src_tz, dest_tz);
      return convertTimeFromTo(time_am_pm, src_tz, dest_tz);
    }
    else {
      // critical error!
      var errors = [];
      if (!time_am_pm) errors.push('Use a valid time descriptor, like "4:35 pm"');
      if (!src_tz) errors.push('Specify a time zone to start in.');
      if (!dest_tz) errors.push('Specify a time zone to convert to.');
      return errors.join('<br/>');
    }
  }
  else {
    return 'Enter something like "2 pm PST in CDT"';
  }
}

function convertTimeFromTo(time_am_pm_match, src_tz, dest_tz) {
  var hours = parseFloat(time_am_pm_match[1]);
  var am_pm = (time_am_pm_match[3] || 'am').toLowerCase();
  // 1 pm to 11 pm should be converted to 13 to 23. 12 pm should be left in place
  if (am_pm == 'pm' && hours > 0 && hours < 12) hours += 12;
  if (time_am_pm_match[2]) hours += parseFloat(time_am_pm_match[2].replace(':', '')) / 60.0;

  var dest_hours = hours - src_tz.offset + dest_tz.offset;
  var addendum = '';
  if (dest_hours < 0) {
    addendum = ' yesterday';
    dest_hours += 24;
  }
  else if (dest_hours >= 24) {
    addendum = ' tomorrow';
    dest_hours -= 24;
  }

  return formatHours(dest_hours) + addendum;
}

function formatHours(hours_float) {
  var am_pm = hours_float < 12 ? 'am' : 'pm';
  if (hours_float > 12) {
    hours_float -= 12;
    am_pm = 'pm';
  }
  var hour_part = hours_float | 0;
  var minute_part = ((hours_float - hour_part) * 60) | 0;
  if (minute_part < 10) minute_part = '0' + minute_part; // padLeft
  // at the last minute, convert 0:00 to 12:00 and so, for bizarre but universal time convention
  if (hour_part == 0) hour_part = 12;
  return hour_part + ":" + minute_part + " " + am_pm;
}

function old_init() {
  var per_row = (((timezones.length + 2) / 3) | 0), hint_trs = [];
  for (var i = 0; (i * 3) + 2 < timezones.length; i++) {
    var tds = new Array(6);
    for (var j = 0; j < 3; j++) {
      var mod = (j * per_row) + i;
      var timezone = timezones[mod];
      if (timezone) {
        tds[j*2] = '<span class="id">' + timezone.id + ':</span>';
        tds[j*2 + 1] = timezone.name;
      }
    }
    hint_trs.push('<td>' + tds.join('</td><td>') + '</td>');
  }
  $('#hints tbody').html('<tr>' + hint_trs.join('</tr><tr>') + '</tr>');
  $('#input input').keyup(function() {
    var input = localStorage.last_input = $(this).val();
    var output = validateInput(input);
    $('#output').html(output);
  }).val(localStorage.last_input || '2 pm PST in CDT').keyup();
}
