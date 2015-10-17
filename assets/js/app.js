/**
 * 
 */

var chart = c3.generate({
    bindto: '#chart',
    color: {
    	  pattern: ['#1F8A70', '#7F0000', '#D7A203']
    	},
    data: {
      columns: [
        ['Failed', 30, 200, 100, 400, 150, 250],
        ['Passed', 50, 20, 10, 40, 15, 25]
      ],
      type : 'pie',
      onclick: function (d, i) { console.log("onclick", d, i); },
      onmouseover: function (d, i) { console.log("onmouseover", d, i); },
      onmouseout: function (d, i) { console.log("onmouseout", d, i); }
    }
});

$( ".tab-pane.fade:first" ).addClass( "in active" );