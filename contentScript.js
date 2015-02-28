console.log("== CONTENT SCRIPT LAUNCHED ==");

$('title').html("Scheduler X");

if (document.URL.match(/localmotion\/?$/)) {
  mainBookingPage();
}

if (document.URL.match(/localmotion\/book\/filter/)) {
  bookFilterPage();
}




// Modifier for the main page, adding the select option
function mainBookingPage () {
  console.log("== IN MAIN BOOKING PAGE ==");

  var select = '<div class="form-group"><label>SCHEDULER X MODE</label>';
  select += '<div class="row"><div class="col-xs-12"><select id="scheduler-x-mode" class="col-xs-12 ember-view input-lg">';
  select += '<option value="standard">Standard scheduler</option>';
  select += '<option value="balance">Balance distance</option>';
  select += '<option value="kill-old">Kill old cars</option>';
  select += '</div></div></div>';

  function updateSchedulerXMode () {
    var newMode = $('#scheduler-x-mode option:selected').val();
    console.log('NEW MODE CHOSEN: ' + newMode);
    localStorage.setItem('schedulerXMode', newMode);
  }

  // Least ugly way to detect when the page has finished loading (DOM ready is fired too soon)
  function checkPageReadyThenModify () {
    if ($('button.btn-primary').length === 0) {
      setTimeout(checkPageReadyThenModify, 150);
      return;
    }

    $('button.btn-primary').parent().prepend(select);
    $('#scheduler-x-mode').on('change', function () {
      updateSchedulerXMode();
    });
    updateSchedulerXMode();
    $('button.btn-primary').on('click', function () {
      bookFilterPage();
    })
  }
  checkPageReadyThenModify();
}


// Modifier for the booking filter page
function bookFilterPage () {
  console.log("== IN BOOKING FILTER PAGE ==");

  var optimizationFunction;

  if (localStorage.getItem('schedulerXMode') === 'standard') { return; }
  if (localStorage.getItem('schedulerXMode') === 'balance') { optimizationFunction = _.min; }
  if (localStorage.getItem('schedulerXMode') === 'kill-old') { optimizationFunction = _.max; }


  function getDistanceFromPlate (plate, cb) {
    $.ajax({ url: 'http://dogfood.getlocalmotion.com/api/localmotion/fleet/search?term=' + plate }).complete(function (jqXHR) {   // Hoping only one search result, the most relevant, is returned. Should be the case (ahem *fingers crossed*)
      var carId = jqXHR.responseJSON.results[0].id;

      $.ajax({ url: 'http://dogfood.getlocalmotion.com/localmotion/fleet/car/' + carId }).complete(function (jqXHR) {
        var text = jqXHR.responseText
          , distance = text.match(/<span use-tooltip="true" title="[^"]*">([^<]*)<\/span>/)[1]   // This is so not going to work when layout is changed (i.e. soon)
          ;
        
        distance = distance.replace(/[\n\r ]/g, '');   // Ugh
        distance = parseInt(distance, distance);   // Playing on the alpha characters here, he he he

        cb(null, distance);
      });

    });
  }

  // Least ugly way to detect when the page has finished loading (DOM ready is fired too soon)
  function checkPageReadyThenModify () {
    if ($('#unavailableLink').length === 0) {
      setTimeout(checkPageReadyThenModify, 150);
      return;
    }
  
    var $availableVehiclesPlates = $('div.vehicle div.label-plate')
      , availableVehiclesPlates = []
      , withDistances = []
      , i, $row
      ;


    for (i = 0; i < $availableVehiclesPlates.length; i += 1) {
      $row = $($availableVehiclesPlates[i]).parent().parent().parent().parent();
      availableVehiclesPlates.push({ plate: $($availableVehiclesPlates[i]).text(), $row: $row });
      $row.hide();
    }

    // Don't let user choose unavailable cars
    $('#unavailableLink').hide();

    // Display a please wait message while fetching the data
    var $pleaseWait = '<div class="ember-view row vehicle" style="display: block;"><div class="col-xs-8"><div class="vehicle-wrapper"><div class="pic"><br><br>';
    $pleaseWait += '<img class="ember-view" data-original="http://thumbik-dev.getlocalmotion.com/w_100,h_100,t_FIT/3fceac7d-afd3-4cf4-8490-a6d2e0286e28.png" src="http://pinpopular.in/images/spinner_192.gif" style="display: inline; width: 35px; height: 35px;">';
    $pleaseWait += '</div><div class="vehicle-body"><br><br><h3>Scheduler X is working ...</h3><div class="label-plate">Please wait</div></div></div></div></div>';
    $pleaseWait = $($pleaseWait);
    $('div.vehicle-list div:first').after($pleaseWait);

    // Slightly modify above message to know how many vehicles were available in theory
    var availableMessagePieces = $('div.vehicle-list div:first').text().replace(/[\n\r]/g, '').trim().match(/([0-9]+ vehicles?) (.*)/)
      , availableMessage = availableMessagePieces[1] + ' in theory ' + availableMessagePieces[2]
      , availableBox = '<div class="col-xs-8"><div class="list-heading text-muted">' + availableMessage + '</div></div>'
      ;
    $('div.vehicle-list div:first').html(availableBox);

    // Get all distances in parallel (let's make this server burn)
    async.each(availableVehiclesPlates, function (it, cb) {
      getDistanceFromPlate(it.plate, function (err, distance) {
        withDistances.push({ plate: it.plate, distance: distance, $row: it.$row });
        return cb(null);
      });
    }, function (err) {
      var bestSuitable = optimizationFunction(withDistances, function (it) { return it.distance; });
      bestSuitable.$row.show();
      $pleaseWait.hide();
    });
  }
  checkPageReadyThenModify();
}





