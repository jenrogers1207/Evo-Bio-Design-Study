import '../styles/index.scss';
import * as d3 from "d3";
import * as d3Array from 'd3-array'
import {pathSelected, renderComparison} from './selectedPaths';
import {formatAttributeData, maxTimeKeeper, scalingValues, generateTraitScale} from './dataFormat';
import {filterMaster, nodeFilter, getLatestData, leafStateFilter, getScales} from './filterComponent';
import { drawBranchPointDistribution } from './distributionView';
import { dropDown } from './buttonComponents';

let valueParam = 'realVal'

const dimensions = {
    rectWidth: 15,
    rectHeight: 40,
    collapsedHeight: 20,
}

export function calcVolatility(data, attribute){

    let length = data.length;

    let sumKeeper = [];
    let valKeeper = [];

    for(let i = 1; i < length; i++){

        let one = i - 1;
        let two = i;

        if(data[one] && data[two]){
        
            let diff = data[one].attributes[attribute].values[valueParam] - data[two].attributes[attribute].values[valueParam];
            let diffSquared = diff * diff;
            sumKeeper.push(diffSquared);
            valKeeper.push(data[one].attributes[attribute].values[valueParam])
        }
    }


    let characterShifts = [];

    if(data[0].attributes[attribute].type === 'discrete'){

        let first = d3.entries(data[0].attributes[attribute].values).filter(f=> {
            let max = d3.max(d3.entries(data[0].attributes[attribute].values), d=> +d.value);
            return +f.value === max;
        });

        data.map((d)=> {
       
            let next = d3.entries(d.attributes[attribute].values).filter(f=> {
                let max = d3.max(d3.entries(d.attributes[attribute].values), d=> +d.value);
                return +f.value === max;
            });
         
            if(next === undefined){
                if(!first[first.length - 1].key.includes(d.winState)){
                    first.push({'key': d.winState, 'value': 1});
                }

            }else{

                if(next.length === 1){
                    if(next[0].key != first[first.length - 1].key){
                        first.push(next[0]);
                    }
                }
            }

            characterShifts.push(first);
        
            return d;
        });
    }

    return data.map(d=> {
        if(d.attributes[attribute].type === 'continuous'){
            //d.attributes[attribute].volatility = d3.deviation(valKeeper);//Math.sqrt(d3.mean(sumKeeper));//d3.variance(sumKeeper) / d3.mean(sumKeeper);
            d.attributes[attribute].volatility = d3.deviation(sumKeeper);//Math.sqrt(d3.mean(sumKeeper));//d3.variance(sumKeeper) / d3.mean(sumKeeper);
            d.attributes[attribute].extent = d3.extent(valKeeper);
            d.attributes[attribute].maxDiff = d3.extent(valKeeper)[1] - d3.extent(valKeeper)[0];
            return d;
        }else{
            d.attributes[attribute].characterShifts = characterShifts[0].length;
        }
    });
}

export function SortPathsByTrait(trait, paths, main){
    console.log(trait, paths);

    let test = paths.sort((a, b)=> {
        return  b[b.length - 1].attributes[trait.field].volatility - a[a.length - 1].attributes[trait.field].volatility;
    });

    console.log(test);

    drawPathsAndAttributes(test, main)

}

export function drawPathsAndAttributes(pathData, main){

    let width = 800;
    let scales = getScales();
    let nodeTooltipFlag = true;

    let collapsed = d3.select('#scrunch').attr('value');
    main.select('#main-path-view').selectAll('*').remove();

    let optionArray = scales.map(m=> {
        let newOb = {}
        newOb.field = m.field;
        newOb.type = m.type;
        newOb.popDeviation = m.type === 'continuous' ? m.popDeviation : null;
        newOb.popCharShift = m.type === 'continuous' ? null : m.popCharShift;
        return newOb;
    });

    let sortBar = main.append('div').style('width', '100%').style('height', '70px');
    let dropWrap = sortBar.append('div');
    let popStatWrap = sortBar.append('div');

    let traitSortOp = dropDown(dropWrap, optionArray, 'Sort By', 'trait-path-sort');
    traitSortOp.on('click', (d)=>{

        d3.select('#trait-path-sort').classed('show', false);
        popStatWrap.selectAll('*').remove();

        popStatWrap.append('text').text(`Sorted By : ${d.field} `)

        popStatWrap.append('text').text(`Volatility of Population : ${d.popDeviation}`)

        console.log('d', d);
        SortPathsByTrait(d, pathData, main);
    });

    let pathGroups = renderPaths(pathData, main, 800);
  
      /// LOWER ATTRIBUTE VISUALIZATION ///
    let attributeWrapper = pathGroups.append('g').classed('attribute-wrapper', true);
    let shownAttributes = d3.select('#attribute-show').selectAll('input').filter((f, i, n)=> n[i].checked === true).data();
    let attData = formatAttributeData(pathData, scales, shownAttributes);

    if(collapsed != 'true'){

        let combinedAttGroup = pathGroups.append('g').classed('all-att-combo', true);
        combinedAttGroup.datum((d,i)=> attData[i])
        combinedAttGroup.attr('transform', `translate(${width + 180}, -9)`)
        combinedAttGroup.append('rect')
            .attr('width', 80)
            .attr('height', 40)
            .attr('fill', '#fff')
            .style('fill-opacity', '0.6')
            .style('stroke', 'gray')
            .style('stroke-width', '0.7px');

        let comboLineGroups = combinedAttGroup.selectAll('g.combo-lines').data((d, i)=> {
            return d}).join('g').classed('combo-lines', true);
    
        let comboLine = continuousPaths(comboLineGroups.filter(f=> f[0].type === 'continuous'), collapsed, 80, 0.3, false);

        pathGroups.append('text').text('Volatility').attr('transform', `translate(${1100}, ${30})`);
        pathGroups.append('text').text('Val Range').attr('transform', `translate(${1200}, ${30})`);
        // pathGroups.append('text').text('Min Val').attr('transform', `translate(${1190}, ${30})`);
        // pathGroups.append('text').text('Max Val').attr('transform', `translate(${1290}, ${30})`);
        // pathGroups.append('text').text('State Shifts').attr('transform', `translate(${1300}, ${30})`);

    }
   
    let predictedAttrGrps = renderAttributes(attributeWrapper, attData, collapsed);
    let attributeHeight = (collapsed === 'true')? 22 : 45;
    pathGroups.attr('transform', (d, i)=> 'translate(10,'+ (i * ((attributeHeight + 5)* (shownAttributes.length + 1))) +')');

    let cGroups = drawContAtt(predictedAttrGrps, collapsed, width);
    let dGroups = drawDiscreteAtt(predictedAttrGrps, collapsed, false, width);

    if(collapsed != 'true'){

        let compactLineG = cGroups.append('g').classed('compact-line', true);
        compactLineG.attr('transform', `translate(${width + 40}, 0)`);
        compactLineG.append('rect').attr('width', 80).attr('height', 40).classed('attribute-rect', true);
    
        let innerPaths = continuousArea(compactLineG.filter(f=> f[0].type === 'continuous'), collapsed, 80, 1);
        compactLineG.on('mouseover', (d, i, n)=> {
            let test = d3.select(n[i].parentNode.parentNode.parentNode).selectAll('g.combo-lines');
            test.filter(f=> {
                return f[0].field === d[0].field;
            }).select('path')
            .style('stroke', (s)=> s[0].color)
            .style('opacity', 1);
        }).on('mouseout', (d, i, n)=> {
            let test = d3.select(n[i].parentNode.parentNode.parentNode).selectAll('g.combo-lines');
            test.filter(f=> {
                return f[0].field === d[0].field;
            }).select('path')
            .style('stroke', 'gray')
            .style('opacity', 0.4);
        });

        var zero = d3.format(".2n");

        let contDist = drawDistLines(compactLineG.filter(f=> f[0].type != 'continuous'));
      
        let volatilityGroups = cGroups.filter(f=> {
            return f[0].type === "continuous"});
      

        let volatility = volatilityGroups.append('g').append('text').text(d=> zero(d[d.length - 1].volatility));
        volatility.attr('transform', `translate(${970}, ${30})`);
         let valRange = volatilityGroups.append('g').append('text').text(d=> zero(d[d.length - 1].extent[1] - d[d.length - 1].extent[0]));
        valRange.attr('transform', `translate(${1075}, ${30})`);
        // let minVal = volatilityGroups.append('g').append('text').text(d=> zero(d[d.length - 1].extent[0]));
        // minVal.attr('transform', `translate(${1050}, ${30})`);
        // let maxVal = volatilityGroups.append('g').append('text').text(d=> zero(d[d.length - 1].extent[1]));
        // maxVal.attr('transform', `translate(${1150}, ${30})`);


        ////DISCRETE CHAR SHIFTS
        let shiftGroups = cGroups.filter(f=> {
            return f[0].type != "continuous"});

        let shiftVal = shiftGroups.append('g').append('text').text(d=> d[d.length - 1].characterShifts);
        shiftVal.attr('transform', `translate(${975}, ${30})`);

       
    }
    sizeAndMove(main.select('#main-path-view'), attributeWrapper, pathData, (shownAttributes.length * attributeHeight));

    let leafStates = d3.selectAll('.discrete-leaf');
    leafStates.on('click', (d, i)=> {
        if(nodeTooltipFlag){
            nodeTooltipFlag = false;
            d3.select("#state-tooltip").classed("hidden", true);
        }else{
            nodeTooltipFlag = true;
            d3.select("#state-tooltip")
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 28) + "px")
            .select("#value")
            .text(d.winState);
            d3.select("#state-tooltip").classed("hidden", false);

            d3.select("#filter-by-state").on('click', ()=> {
                leafStateFilter(d, scales);
                nodeTooltipFlag = false;
                d3.select("#state-tooltip").classed("hidden", true);
            });

            d3.select("#select-by-state").on('click', ()=> {
                let data = getLatestData();
                let test = data.filter(path => {
                    return path[path.length - 1].attributes[d.label].winState === d.winState;
                });

                let notIt = data.filter(path => {
                    return path[path.length - 1].attributes[d.label].winState != d.winState;
                });
            
                nodeTooltipFlag = false;
                d3.select("#state-tooltip").classed("hidden", true);

                pathSelected(test, notIt, scales);
            });

        }});

    return pathGroups;

}

function drawDistLines(discG){

    let comboDisc = discG.selectAll('g.states').data(d=> {
        let states = d[0].map(m=> m.key).map(m=> {
            let values = d.filter(f=> f.leaf != true).flatMap(v=> v.filter(f=> f.key === m));
            return {key: m, 'value': values};
        });
        return states;
    }).join('g').classed('states', true);

    comboDisc.append('text').text(d=> d.key).style('font-size', '7px').style('fill', 'gray').attr('x', 83).attr('y', 3.5);

    function round_to_precision(x, precision) {
        var y = +x + (precision === undefined ? 0.5 : precision/2);
        return y - (y % (precision === undefined ? 1 : +precision));
    }

    let comboStates = comboDisc.selectAll('g.state-node')
    .data(d=> {
        let toGroup = d.value.map((v, i, n)=> {
            v.value = +v.value;
            v.endLength = i < n.length - 1 ? n[i+1].combLength : maxTimeKeeper[maxTimeKeeper.length - 1];
            return v;
        });
        return  Array.from(d3Array.group(toGroup, v=> round_to_precision(v.value, .005)));
    }).join('g').classed('state-node', true);
  
    comboDisc.attr('transform', (d, i, n)=> {
        let step = 40 / n.length;
        return `translate(0, ${(i * step)+(step/2.2)})`});
    
        comboStates.append('rect')
            .attr('width', (d, i)=>{
                let vals = d[1]
                let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0,80])
                return (x(vals[vals.length-1].endLength) - x(vals[0].combLength)) - .5;
            })
            .attr('height', (d, i)=> {
                let sizer = d3.scaleLinear().domain([0, 1]).range([0.2, 6]);
                return sizer(d[0]);
            })
            .attr('fill', 'gray')
            .attr('opacity', 0.4)
            .attr('y', (d)=> {
                let sizer = d3.scaleLinear().domain([0, 1]).range([0.2, 6]);
                return (sizer(d[0]) / 2) * -1;
            });

        comboStates.attr('transform', (d, i)=> {
            let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0,80])
            return `translate(${x(d[1][0].combLength)},0)`;
        });

    return comboDisc;
}
export function sizeAndMove(svg, attribWrap, data, attrMove){
        //tranforming elements
    svg.style('height', ((data.length * (attrMove + 52))) + 'px');
    attribWrap.attr('transform', (d)=> 'translate(140, 35)');
        ///////////////////////////////////
}
export function renderPaths(pathData, main, width){

    let scales = getScales();

    ////YOU SHOULD MOVE THESE APPENDING THINGS OUT OF HERE///////
    /////Rendering ///////
    let svgTest = main.select('#main-path-view');
    let svg = svgTest.empty() ? main.append('svg').attr('id', 'main-path-view') : svgTest;
    
    let nodeTooltipFlag = false;

    let pathWrapTest = svg.select('.path-wrapper');
    let pathWrap = pathWrapTest.empty() ? svg.append('g').classed('path-wrapper', true) : pathWrapTest;
    pathWrap.attr('transform', (d, i)=> 'translate(0,20)');

      /////Counting frequency of nodes//////
    let branchFrequency = pathData.flatMap(row=> row.flatMap(f=> f.node)).reduce(function (acc, curr) {
        if (typeof acc[curr] == 'undefined') {
          acc[curr] = 1;
        } else {
          acc[curr] += 1;
        }
        return acc;
        }, {});

     ///Scales for circles ///
    let circleScale = d3.scaleLog().range([6, 12]).domain([1, d3.max(Object.values(branchFrequency))]);
    let pathGroups = pathWrap.selectAll('.paths').data(pathData).join('g').classed('paths', true);
    let pathBars = pathGroups.append('rect').classed('path-rect', true);
    pathBars.style('width', '100%');
    pathBars.attr('y', -12);

    //////////
    ///Selecting species
    /////////
    let pathAdd = pathGroups.append('g').classed("fas fa-search-plus", true);
    pathAdd.attr('transform', 'translate(15, 10)');
    pathAdd.append('circle').attr('r', 7).attr('fill', '#fff');
    pathAdd.append('text').text('+').attr('transform', 'translate(-5, 5)');
    pathAdd.style('cursor', 'pointer');

    pathAdd.on('click', (d, i, n)=>{

        let notIt = d3.selectAll(n).filter((f, j)=> j != i).classed('selected-path', false);
     
        if(d3.select(n[i]).classed('selected-path')){
            d3.select(n[i]).classed('selected-path', false);
            pathSelected(null, notIt.data(), scales, width);
        }else{
            d3.select(n[i]).classed('selected-path', true);
            pathSelected([d], notIt.data(), scales, width);
        }
    });

    /////////
    pathGroups.on('mouseover', function(d, i){
        let treeNode  = d3.select('#sidebar').selectAll('.node');
        let treeLinks  = d3.select('#sidebar').selectAll('.link');
        treeNode.filter(f=> {
            return d.map(m=> m.node).indexOf(f.data.node) > -1;
        }).classed('hover', true);
        treeLinks.filter(f=> d.map(m=> m.node).indexOf(f.data.node) > -1).classed('hover', true);
        return d3.select(this).classed('hover', true);
    }).on('mouseout', function(d, i){
        let treeNode  = d3.select('#sidebar').selectAll('.node').classed('hover', false);
        let treeLinks  = d3.select('#sidebar').selectAll('.link').classed('hover', false);
        return d3.select(this).classed('hover', false);
    });

    let speciesTitle = pathGroups.append('text').text(d=> {
       let string = d.filter(f=> f.leaf === true)[0].node;
        return string.charAt(0).toUpperCase() + string.slice(1);
    });

    speciesTitle.attr('x', 25).attr('y', 15);

    let timelines = pathGroups.append('g').classed('time-line', true);
    timelines.attr('transform', (d, i)=> 'translate(150, 0)');

    let lines = timelines.append('line')
    .attr('x1', 0)
    .attr('x2', width)
    .attr('y1', 15)
    .attr('y2', 15);

    let nodeGroups = timelines.selectAll('.node').data((d)=> {
        return d}).join('g').attr('class', (d, i, n)=> {
            return d3.select(n[n.length - 1]).data()[0].node + " node";
        });
   
    nodeGroups.attr('transform', (d)=> {
        let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, width]);
        let distance = x(d.combLength);
        return 'translate('+ distance +', 10)';});

    nodeGroups.on('click', (d, i, n)=> {
        if(nodeTooltipFlag){
            nodeTooltipFlag = false;
            d3.select("#branch-tooltip").classed("hidden", true);
        }else{
            nodeTooltipFlag = true;
            d3.select("#branch-tooltip")
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 28) + "px")
            .select("#value")
            .text(d.node);
            d3.select("#branch-tooltip").classed("hidden", false);

            d3.select("#filter-by-node").on('click', ()=> {
                nodeFilter(d.node, scales);
                nodeTooltipFlag = false;
                d3.select("#branch-tooltip").classed("hidden", true);
            });

            d3.select("#select-by-node").on('click', ()=> {
                let data = getLatestData();
                let test = pathGroups.filter(path => {
                    return path.map(node => node.node).indexOf(d.node) > -1;
                });
                let notIt = pathGroups.filter(path => {
                    return path.map(node => node.node).indexOf(d.node) === -1;
                });
                nodeTooltipFlag = false;
                d3.select("#branch-tooltip").classed("hidden", true);
                pathSelected(test.data(), notIt.data(), scales, width);
            });
        }
    });

    let circle = nodeGroups.append('circle').attr('cx', 0).attr('cy', 0).attr('r', d=> {
        return circleScale(branchFrequency[d.node]);
    }).attr('class', (d, i)=> 'node-'+d.node);

    circle.on('mouseover', function(d, i){
        let hovers = nodeGroups.filter(n=> n.node === d.node);
        let treeNode  = d3.select('#sidebar').selectAll('.node');
        let selectedBranch = treeNode.filter(f=> f.data.node === d.node).classed('selected-branch', true);
        return hovers.classed('hover-branch', true);
    }).on('mouseout', function(d, i){
        let hovers = nodeGroups.filter(n=> n.node === d.node);
        d3.selectAll('.selected-branch').classed('selected-branch', false);
        return hovers.classed('hover-branch', false);
    });

    let speciesNodeLabel = nodeGroups.filter(f=> f.label != undefined).append('text').text(d=> {
        let string = d.label.charAt(0).toUpperCase() + d.label.slice(1);
        return string;
    }).attr('x', 10).attr('y', 5);

    return pathGroups;
}
export function renderAttributes(attributeWrapper, data, collapsed){

    let attributeHeight = (collapsed === 'true')? 20 : 45;
    let predictedAttrGrps = attributeWrapper.selectAll('g').data((d, i)=> {
        return data[i]}).join('g');
    predictedAttrGrps.classed('predicated-attr-groups', true);
    predictedAttrGrps.attr('transform', (d, i) => 'translate(0, '+(i * (attributeHeight + 5))+')');

    let attrLabel = predictedAttrGrps.append('text').text(d=> {
        return d[d.length - 1].label ? d[d.length - 1].label : d[d.length - 1].attrLabel
    });
    attrLabel.classed('attribute-label', true);
    attrLabel.attr('transform', 'translate(-15, 20)');

    return predictedAttrGrps;

}
function collapsedPathGen(data){
    data.map((p, i)=>{
        let step = i === 0 ? 0 : 1;
        let test = (p[valueParam] > data[i-step][valueParam]) ? 1 : 18;
        p.change = test;
    })
}
async function continuousArea(innerTimeline, collapsed, width){

     //THIS IS THE PATH GENERATOR FOR THE CONTINUOUS VARIABLES
     let height = (collapsed === 'true')? dimensions.collapsedHeight : dimensions.rectHeight;
     var lineGen = d3.area()
     .x(d=> {
         let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, width]);
         let distance = x(d.combLength);
         return distance; })
     .y1(d=> {
         let y = d.scales.yScale;
         y.range([40, 0]);
         if(collapsed === 'true'){
             return d.change;
         }else{
             return y(d.values[valueParam]);
         }
     }).y0(d=> {
        let y = d.scales.yScale;
        y.range([40, 0]);
        return 40
    });
 
     let innerPaths = innerTimeline.append('path')
     .attr("d", lineGen)
     .style('fill', (d)=> d[0].color)
     .style('stroke-width', '1px')
     .style('stroke', (d)=> d[0].color)
     .style('fill-opacity', 0.3);
 
     return innerPaths;

}
async function continuousPaths(innerTimeline, collapsed, width, opacity, colorBool){

    innerTimeline.data().forEach(path => {
        collapsedPathGen(path);
    });

    //THIS IS THE PATH GENERATOR FOR THE CONTINUOUS VARIABLES
    let height = (collapsed === 'true')? dimensions.collapsedHeight : dimensions.rectHeight;
    var lineGen = d3.line()
    .x(d=> {
        let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, width]);
        let distance = x(d.combLength);
        return distance; })
    .y(d=> {
       
        //let y = generateTraitScale([scalingValues(d.scales.min), scalingValues(d.scales.max)], [height, 0])
        let y = generateTraitScale([d.scales.min, d.scales.max], [height, 0])
        if(collapsed === 'true'){
            return d.change;
        }else{
            return y(d.values[valueParam]);
        }
    });

    let innerPaths = innerTimeline.append('path')
    .attr("d", lineGen)
    .attr("class", "inner-line")
    .style('stroke', (d)=> {
        return colorBool ? d[0].color : 'gray'
    })
    .style('opacity', opacity);

    return innerPaths;
    ///////////////////////////////////////////////////////////
}
export function drawContAtt(predictedAttrGrps, collapsed, width){

    let continuousAtt = predictedAttrGrps.filter(d=> {
        return (d[d.length - 1] != undefined) ? d[d.length - 1].type === 'continuous' : d.type === 'continuous';
    });

    let attributeHeight = (collapsed === 'true') ? dimensions.collapsedHeight : dimensions.rectHeight;
    let innerTimeline = continuousAtt.append('g').classed('attribute-time-line', true);
    /////DO NOT DELETE THIS! YOU NEED TO SEP CONT AND DICRETE ATTR. THIS DRAWS LINE FOR THE CONT/////
    let innerPaths = continuousPaths(innerTimeline, collapsed, width, 1, true);

    ////////
    let attribRectCont = innerTimeline.append('rect').classed('attribute-rect', true);
    attribRectCont.attr('height', attributeHeight);
    attribRectCont.attr('width', width);
    let attributeNodesCont = innerTimeline.selectAll('g').data(d=> d).join('g').classed('attribute-node', true);

    let innerBars = attributeNodesCont.append('g').classed('inner-bars', true);

    innerBars.attr('transform', (d)=> {
        let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, width]);
        let distance = x(d.combLength);
        return 'translate('+ distance +', 0)';});
      
    let rangeRect = innerBars.append('rect').classed('range-rect', true);
    rangeRect.attr('width', dimensions.rectWidth).attr('height', (d, i)=> {
        let y = generateTraitScale([d.scales.min, d.scales.max], [attributeHeight-3, 0]);
       // let y = generateTraitScale([scalingValues(d.scales.min), scalingValues(d.scales.max)], [attributeHeight-3, 0])

        // let up = valueParam === 'realVal' ? +d.values.upperCI95 : +d.values.logUpper;
        // let low = valueParam === 'realVal' ? +d.values.lowerCI95 : +d.values.logLower;
      
        let range = 0;
        if(d.leaf != true){ 
            range = Math.abs(y(+d.values.lowerCI95) - y(+d.values.upperCI95)); 
        }

        let barHeight = (collapsed === 'true') ? dimensions.collapsedHeight : range;
        return barHeight;
    });

    rangeRect.attr('transform', (d, i)=> {

        let y = d3.scaleLinear();
        // let min = scalingValues(d.scales.min);
        // let max = scalingValues(d.scales.max);
        let min = d.scales.min;
        let max = d.scales.max;

        y.domain([min, max]);
        y.range([attributeHeight, 0]).clamp(true);

        //let up = valueParam === 'realVal' ? +d.values.upperCI95 : +d.values.logUpper;
       // let up = valueParam === 'realVal' ? +d.values.upperCI95 : +d.values.logUpper;
        let move = (d.leaf || (collapsed === 'true')) ? 0 : y(+d.values.upperCI95);
       
        return 'translate(0, '+ Math.abs(move) +')';
    });
    rangeRect.style('fill', (d)=> {
        return d.colorScale(d.values[valueParam]);
    });
    rangeRect.attr('opacity', (d)=> {
        return d.satScale(d.values[valueParam]);
    });
    if(collapsed != 'true'){
        innerBars.append('rect').attr('width', dimensions.rectWidth).attr('height', 4)
        .attr('transform', (d, i)=> {
            let y = generateTraitScale([d.scales.min, d.scales.max], [attributeHeight, 0])
            return 'translate(0, '+ y(d.values[valueParam]) +')';})
        .attr('fill', d=> d.color).classed('val-bar', true);
    }

    /////AXIS ON HOVER////
    innerBars.on('mouseover', (d, i, n)=> {
        let y = generateTraitScale([d.scales.min, d.scales.max], [0, attributeHeight]);
        //let y = generateTraitScale([scalingValues(d.scales.min), scalingValues(d.scales.max)], [0, attributeHeight]);
        d3.select(n[i]).append('g').classed('y-axis', true).call(d3.axisLeft(y).ticks(5));

        let tool = d3.select('#tooltip');
        tool.transition()
          .duration(200)
          .style("opacity", .9);

        let f = d3.format(".3f");

        let up = valueParam === 'realVal' ? +d.values.upperCI95 : +d.values.logUpper;
        let low = valueParam === 'realVal' ? +d.values.lowerCI95 : +d.values.logLower;

        tool.html('mean: '+f(d.values[valueParam]) +"</br>"+"</br>"+ 'upperCI: '+ f(up) +"</br>"+"</br>"+ 'lowerCI: '+ f(low))
          .style("left", (d3.event.pageX) + "px")
          .style("top", (d3.event.pageY - 28) + "px");
          
        tool.style('height', 'auto');
       
    }).on('mouseout', (d, i, n)=> {
        d3.select(n[i]).select('g.y-axis')
        d3.select(n[i]).select('g.y-axis').remove();
        let tool = d3.select('#tooltip');
        tool.transition()
          .duration(500)
          .style("opacity", 0);
    });

    return predictedAttrGrps;
   
}
export function findMaxState(states, offset){
    let maxP = d3.max(states.map(v=> v.values.realVal));
    let notMax = states.filter(f=> f.values.realVal != maxP);
    let winState = states[states.map(m=> m.values.realVal).indexOf(maxP)]
    winState.other = notMax;
    winState.offset = offset;
    return winState;
}
    //BEGIN TEST
function drawLeaves(attWraps, groupBy){
    //THIS IS HARD CODED AND SHOULD NOT BE

    let numSpecies = 100;
    let height = 40;

    //CONTINUOUS 
    let leafWraps = attWraps.filter(f=> f.type === 'continuous').selectAll('g.observe-wrap-first.continuous').data(d=> {
            let totalVal = attWraps.data().filter(f=> f.label === d.label).map(m=> m.data);
            let totalArray = totalVal.flatMap(p=> p.flatMap(f=> f.paths[f.paths.length - 1][valueParam]));

            let max = d3.max(totalArray);
            let min = d3.min(totalArray);
            let totalMean = d3.mean(totalArray);
        
            let x = d3.scaleLinear().domain([min, max]).range([0, 200]);
            let newVal = d.data.map((m, i)=> {
                m.index = i;
                return {'value': m.paths[m.paths.length - 1].values[valueParam], 'x': x, 'min': min, 'max': max, 'species':m.species };
            });
            let groupMean = d3.mean(newVal.map(v=> v.value));
            return [{'dotVals':newVal, 'x': x, 'totalMean': totalMean, 'groupMean':groupMean}];
        }).join('g').classed('observe-wrap-first continuous', true);
        
        leafWraps.attr('transform', 'translate(850, 0)');
        
        let xAxis = leafWraps.append('g').classed('axis-x', true);
        xAxis.attr('transform', 'translate(0, '+(height - 15)+')');
        xAxis.each((d, i, nodes)=> {
            d3.select(nodes[i]).call(d3.axisBottom(d.x).ticks(5));
        });
        
        let totalMeanLine = leafWraps.append('rect').classed('line', true).attr('transform', (d, i)=> 'translate('+(d.x(d.totalMean)-1.5)+',0)')
        .attr('height', (height - 15)).attr('width', 3).attr('fill', 'red').style('opacity', '0.4');
        
        let groupMeanLine = leafWraps.append('rect').classed('line', true).attr('transform', (d, i)=> 'translate('+(d.x(d.groupMean)-1.5)+',0)')
        .attr('height', (height - 15)).attr('width', 3).attr('fill', 'gray').style('opacity', '0.4');
        
        let distCircGroupOut = leafWraps.append('g').attr('transform', 'translate(0, 20)');
        let distcirclesOut = distCircGroupOut.selectAll('circle').data(d=> d.dotVals).join('circle');
        distcirclesOut.attr('r', 4).attr('cx', (d, i)=> d.x(d.value)).style('opacity', '0.3');

        //DISCRETE//
        let leafWrapsD = attWraps.filter(f=> f.type === 'discrete').selectAll('g.observe-wrap-first.discrete').data(d=> {
          return [d];
        }).join('g').classed('observe-wrap-first discrete', true);

        let rects = leafWrapsD.filter(f=> {
            return f.label != groupBy;
        }).selectAll('rect').data(d=> {
            let groupedData = d3Array.groups(d.data.map(m=> m.paths[m.paths.length - 1]), d=> d.state);
            groupedData.sort((a, b)=> b[1].length - a[1].length)
            return groupedData;
        }).join('rect').attr('height', 15).attr('width', (d, i, n)=>{
            let scale = d3.scaleLinear().domain([0, d3.sum(d3.selectAll(n).data().map(m=> m[1].length))])
            .range([5, 170]);
            d.width = scale(d[1].length);
            return scale(d[1].length);
        });

        rects.attr('x', (d, i, n)=> {
            if(i === 0){ return 0}
            else {
                d3.selectAll(n).filter((f, j)=> j< i);
                let move = d3.sum(d3.selectAll(n).filter((f, j)=> j< i).data().map(m=> m.width));
                return move;}
        }).attr('y', 12)

        rects.attr('fill', d=> d[1][0].color);

        rects.on('mouseover', (d, i, n)=> {
            let tool = d3.select('#tooltip');
            tool.transition()
              .duration(200)
              .style("opacity", .9);
            
            tool.html(d[0] + "</br>" + d[1].length)
              .style("left", (d3.event.pageX + 10) + "px")
              .style("top", (d3.event.pageY + 20) + "px");

              d3.selectAll(n).filter((f, j)=> j != i).attr('opacity', 0.3);
          
        }).on('mouseout', (s, i, n)=> {
            let tool = d3.select('#tooltip');
            tool.transition()
              .duration(500)
              .style("opacity", 0);

              d3.selectAll(n).filter((f, j)=> j != i).attr('opacity', 1)
        })

        leafWrapsD.attr('transform', 'translate(850, 0)');

        let ratio = leafWrapsD.filter(f=> f.label === groupBy)
            .selectAll('text').data(d=> [d]).join('text').text(d=> {
                let paths = d.data[d.data.length - 1].paths;
                return `${paths[paths.length - 1].state}: ${d.data.length} / ${numSpecies}`
            });
        ratio.style('text-anchor', 'middle')
        ratio.style('font-size', '12px')
        ratio.attr('x', 90).attr('y', 25)
        
    }
export function drawGroups(stateBins, scales){
    
    let groupedBool = d3.select('#show-drop-div-group').attr('value', 'grouped');
    
    let height = 40;
    let selectedTool = d3.select('#selected');
    selectedTool.selectAll('*').remove();
 
    let main = d3.select('#main');
    main.style('padding-top', 0);

    d3.select('#toolbar').append('text').text(stateBins[0].field)

    let splitOnArray = [{'field':'None'}].concat(scales.filter(f=> (f.field != stateBins[0].field) && f.type === 'discrete'));
    let dropOptions = dropDown(d3.select('#toolbar'), splitOnArray, 'Split On','show-drop-div-group');

    ////THIS SPLITS THE DATA////
    dropOptions.on('click', (d, i, n)=> {
        d3.select('#toolbar').append('text').text(d.field);
        
        if(d.type === 'discrete'){
            let newBins = stateBins.map(state=> {
                let newBinData = d.scales.map(sc=> {
                    let field = sc.field;
                    let name = sc.scaleName;
                    let newData = state.data.filter(pa=> {
                        let leaf = pa.filter(le=> le.leaf === true)[0];
                        return leaf.attributes[field].winState === name;
                    });
                    return {'field': field, 'state': name, 'data': newData }
                });
                state.data = newBinData;
                return state;
            });

            //////RENDERING NEED TO SEPARATE OUT/////
           
           let main = d3.select('#main');
           main.selectAll('*').remove();
           main.style('padding-top', '40px');
           let firstGroupDiv = main.selectAll('div.first-group').data(newBins).join('div').classed('first-group', true);
           
           let firstGroupSvg = firstGroupDiv.append('svg');
           firstGroupSvg.attr('height', s=> (s.data.length*270));
           let firstGroup = firstGroupSvg.append('g');
          
           let firstLabel = firstGroup.append('text').text(f=> f.state).attr('transform', 'translate(10, 10)');

           let secondGroup = firstGroup.selectAll('g.second-group').data(g=> {
               let newGroups = g.data.map((m)=>{
                   let newM = {};
                   newM.first = [g.field, g.state];
                   newM.second = [m.field, m.state];
                   newM.data = m.data
                   newM.leaves = m.data.flatMap(path=> path.filter(f=> f.leaf === true));
                   return newM
               });
               return newGroups}).join('g').classed('second-group', true);

           secondGroup = secondGroup.filter(f=> f.data.length > 0);
           secondGroup.attr('transform', (s, i)=> 'translate(30,'+(20 + (i * 270))+')');

           secondGroup.each((s, i, n)=> {
            let branchBar = drawBranchPointDistribution(s.data, d3.select(n[i]));
            branchBar.select('rect').attr('x', -80).attr('fill','gray');
            branchBar.selectAll('.branch-points').selectAll('circle').attr('fill', 'rgba(255, 255, 255, 0.3)');
            
            branchBar.select('.leaf-label').append('text').text((t, i) =>': '+ t.data.length).attr('transform', 'translate(45, 0)');
            branchBar.selectAll('text').style('font-size', '11.5px').style('fill', '#fff');
    
            branchBar.select('line').attr('stroke', '#fff');

            let groupLabels = d3.select(n[i]).append('g');

            //groupLabels.
            let pathAdd = groupLabels.append('g').classed("fas fa-search-plus", true);
            pathAdd.attr('transform', 'translate(-10, 15)');
            pathAdd.append('circle').attr('r', 7).attr('fill', '#fff');
            pathAdd.append('text').text('+').attr('transform', 'translate(-5, 3)').attr('fill', 'gray');
        
            pathAdd.style('cursor', 'pointer');

            pathAdd.on('click', ()=> {
                let other = d3.selectAll(n).filter((f,j)=> j != i);
                renderComparison(s, other.data(), d3.select('#selected'), scales);
            });

            let stateLabel = groupLabels.append('text').text((s, i)=> s.second[1]);
            stateLabel.attr('transform', (d, i)=> 'translate(3, 20)');
            stateLabel.attr('fill', '#fff');
           });

           let innerGroup = secondGroup.filter(f=> f.data.length > 0).append('g').classed('inner-wrap', true);
           innerGroup.attr('transform', (d,i)=> 'translate(110, 0)');

       
           let attWraps = innerGroup.selectAll('.att-wrapper').data((d)=> {
               let atts = formatAttributeData(d.data, scales, null);
             
               let attDataComb = atts[0].map((att, i)=> {
                  
                   let species = d.data[0].filter(f=> f.leaf === true)[0].label;

                   att[att.length - 1].offset = 0;
                   let attribute = {'label': att[att.length-1].label, 'type':att[att.length-1].type, 'data': [{'species': species, 'paths': att}]}
                   for(let index = 1; index < atts.length; index++ ){
                       let species = d.data[index].filter(f=> f.leaf === true)[0].label;
                       let last = atts[index][i].length - 1
                       atts[index][i][last].offset = (index * 8);
                       attribute.data.push({'species': species, 'paths': atts[index][i]});
                   }
                   
                   return attribute;
               });

              let mappedDis = attDataComb.map(dis=> {
                  dis.data = dis.data.map((spec, i)=> {
                      spec.paths = spec.paths.map(m=> {
                            if(dis.type === 'discrete'){
                                let offset = 5 * i;
                                let maxProb = m.states? {'realVal': 1.0, 'state': m.winState, 'color':m.color, 'combLength': m.combLength, 'offset':m.offset, 'leaf': true} : findMaxState(m, offset); 
                                return maxProb;
                            }else{
                                return m;
                            }
                        });
                   return spec;
                  });
        
                  dis.leaves = dis.data.flatMap(f=> f.paths.filter(p=> p.leaf === true));
                  return dis;
              });
              return mappedDis;
           }).join('g').classed('att-wrapper', true);

           let innerWrapRect = attWraps.append('rect').attr('width', 800);

            innerWrapRect.attr('height', height);
            innerWrapRect.style('fill', '#fff');
            innerWrapRect.style('stroke', 'gray');

            attWraps.attr('transform', (d, i)=> 'translate(0,'+((i * (height+5))+ 30)+')');
            wrappers.attr('transform', (d, i)=> 'translate(60,'+(i * (5 * (height+15))+ 50)+')');
            svg.attr('height', (wrappers.data().length * (5 * (height+15))+ 50));

            let labels = attWraps.append('text')
            .text(d=> d.label)
            .style('text-anchor', 'end')
            .style('font-size', 11)
            labels.attr('transform', 'translate(-5,'+(50/2)+')');

////WORKING ON STATE SHIFT VIEW///////
            let shiftWraps = attWraps.filter(f=> f.type === 'discrete').selectAll('g.shift-wrap').data(d=> {
       
                let test = d.data.flatMap(m=> m.paths.filter((f, i)=> {
                    if(i===0) return (i === 0);
                    if(i > 0) return (m.paths[i-1].state != f.state)
                    if(i < m.paths.length - 1) return (m.paths[i+1].state != f.state);
                }));
             
                return [test];
            }).join('g').classed('shift-wrap', true);

            shiftWraps.attr('transform', 'translate(850, 0)');

            let xAxisShift = shiftWraps.append('g').classed('axis-x', true);
            xAxisShift.attr('transform', 'translate(0, '+(height - 15)+')');
            xAxisShift.each((d, i, nodes)=> {
                let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 200]);
                d3.select(nodes[i]).call(d3.axisBottom(x).ticks(5));
            });

            let circGroupShift = shiftWraps.append('g').attr('transform', 'translate(0, 20)');

            let shiftCircles = circGroupShift.selectAll('circle.shift').data(d=> d).join('circle').classed('shift', true);
            shiftCircles.attr('r', 4).attr('cx', (d, i)=> {
                let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 200]);
                return x(d.combLength)
            });
            shiftCircles.attr('fill', d=> d.color).style('opacity', 0.4);

//////DRAW OBSERVED DISTRIBUTIONS/////
            let leafWraps = attWraps.filter(f=> f.type === 'continuous').selectAll('g.observe-wrap').data(d=> {
                let totalVal = attWraps.data().filter(f=> f.label === d.label).flatMap(m=> m.leaves.map(l=> l[valueParam]));
                let max = d3.max(totalVal);
                let min = d3.min(totalVal);
                let totalMean = d3.mean(totalVal);

                let x = d3.scaleLinear().domain([min, max]).range([0, 200])
                let newVal = d.leaves.map((m, i)=> {
                    m.index = i;
                    return {'value': m[valueParam], 'x': x, 'min': min, 'max': max, 'species':m.species };
                });
                let groupMean = d3.mean(newVal.map(v=> v.value));
                return [{'dotVals':newVal, 'x': x, 'totalMean': totalMean, 'groupMean':groupMean}];
            }).join('g').classed('observe-wrap', true);

            leafWraps.attr('transform', 'translate(850, 0)');

            let xAxis = leafWraps.append('g').classed('axis-x', true);
            xAxis.attr('transform', 'translate(0, '+(height - 15)+')');
            xAxis.each((d, i, nodes)=> {
                d3.select(nodes[i]).call(d3.axisBottom(d.x).ticks(5));
            });

            let totalMeanLine = leafWraps.append('rect').classed('line', true).attr('transform', (d, i)=> 'translate('+(d.x(d.totalMean)-1.5)+',0)')
            .attr('height', (height - 15)).attr('width', 3).attr('fill', 'red').style('opacity', '0.4');

            let groupMeanLine = leafWraps.append('rect').classed('line', true).attr('transform', (d, i)=> 'translate('+(d.x(d.groupMean)-1.5)+',0)')
            .attr('height', (height - 15)).attr('width', 3).attr('fill', 'gray').style('opacity', '0.4');

            let distCircGroup = leafWraps.append('g').attr('transform', 'translate(0, 20)');
            let distcircles = distCircGroup.selectAll('circle').data(d=> d.dotVals).join('circle');
            distcircles.attr('r', 4).attr('cx', (d, i)=> d.x(d.value)).style('opacity', '0.3');

            distcircles.on('mouseover', (d, i, n)=> {

                let tool = d3.select('#tooltip');
                tool.transition()
                  .duration(200)
                  .style("opacity", .9);
                let f = d3.format(".3f");
                tool.html(d.species)
                  .style("left", (d3.event.pageX + 10) + "px")
                  .style("top", (d3.event.pageY - 28) + "px");
           
                let leafNodes = d3.select('#sidebar').selectAll('.node--leaf').filter(f=> f.data.label === d.species);
                leafNodes.classed('selected', true);

            }).on('mouseout', (d, i, n)=> {
                d3.select(n[i]).classed('selected', false);

                distcircles.classed('selected', false).style('opacity', 0.3);
                let tool = d3.select('#tooltip');
                tool.transition()
                  .duration(500)
                  .style("opacity", 0);

                let leafNodes = d3.select('#sidebar').selectAll('.node--leaf').filter(f=> f.data.label === d.species);
                leafNodes.classed('selected', false);
            });


            ////DRAW SPECIES GROUPS IN THE ATTRIBUTES

            let speciesGrp = attWraps.selectAll('g.species').data(d=> {
                d.data = d.data.map(m=> {
                    m.type = d.type;
                    return m;
                });
                return d.data;
            }).join('g').classed('species', true);

            let lineGenD = d3.line()
                .x(d=> {
                    let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 800]);
                    let distance = d.combLength;
                    return x(distance);
                    })
                .y(d=> {
                    let y = d3.scaleLinear().domain([0, 1]).range([height-2, 1]);
                    return y(d.realVal);
                });

            let lineGenC = d3.line()
                .x(d=> {
                    let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 800]);
                    let distance = d.combLength;
                    return x(distance);
                })
                .y(d=> {
                   
                    //let y = generateTraitScale([scalingValues(d.scales.min), scalingValues(d.scales.max)], [height-2], 1);
                    let y = generateTraitScale([d.scales.min, d.scales.max], [height-2], 1);
                    return y(d.values[valueParam]) + 2;
                });

            let innerStatePaths = speciesGrp.append('path')
                .attr("d", d=> {
                        return (d.type === 'discrete') ? lineGenD(d.paths) : lineGenC(d.paths);
                    })
                .attr("class", (d, i)=> {
                        return d.species + " inner-line"})
                .style('stroke-width', 0.7)
                .style('fill', 'none')
                .style('stroke', 'gray');

            innerStatePaths.on('mouseover', (d, i, n)=> {
               
                d3.select(n[i]).classed('selected', true);
                distcircles.filter(f=> f.species === d.species).classed('selected', true).style('opacity', 1);

                let tool = d3.select('#tooltip');
                tool.transition()
                  .duration(200)
                  .style("opacity", .9);
                let f = d3.format(".3f");
                tool.html(d.species)
                  .style("left", (d3.event.pageX + 10) + "px")
                  .style("top", (d3.event.pageY - 28) + "px");

                let leafNodes = d3.select('#sidebar').selectAll('.node--leaf').filter(f=> f.data.label === d.species);
                leafNodes.classed('selected', true);
                
            }).on('mouseout', (d, i, n)=> {
                d3.select(n[i]).classed('selected', false);

                distcircles.classed('selected', false).style('opacity', 0.3);
                let tool = d3.select('#tooltip');
                tool.transition()
                  .duration(500)
                  .style("opacity", 0);

                let leafNodes = d3.select('#sidebar').selectAll('.node--leaf').filter(f=> f.data.label === d.species);
                leafNodes.classed('selected', false);
            });

            let disGroup = speciesGrp.filter(sp=> {
            return sp.type === 'discrete';
            });

            let branchGrpDis = disGroup.selectAll('.branch').data(d=>d.paths).join('g').classed('branch', true);

            branchGrpDis.attr('transform', (d)=> {
                let x = d3.scaleLinear().domain([0, 1]).range([0, 800]);
                    let distance = x(d.combLength);
                    return 'translate('+distance+', 0)';
            });

            let bCirc = branchGrpDis.append('circle').attr('r', 5).attr('cy', (d, i)=> {
                let y = d3.scaleLinear().domain([0, 1]).range([height - 5, 2]);
                return y(d.realVal);
            }).attr('cx', 5);

            bCirc.classed('win-state', true);

            bCirc.attr('fill', (d, i, n)=> {
                if(i === 0){
                    return d.color;
                }else if(i === n.length - 1){
                    if(d.state === d3.select(n[i-1]).data()[0].state){
                        return 'rgba(189, 195, 199, 0.3)';
                    }else{
                        d.shift = true;
                        return d.color;
                    }
                }else{
                    if(d.state === d3.select(n[i+1]).data()[0].state || d.state === d3.select(n[i-1]).data()[0].state){
                        return 'rgba(189, 195, 199, 0.3)';
                    }else{
                        d.shift = true;
                        return d.color;
                    }
                }
            });


    let otherCirc = branchGrpDis.filter(f=> f.leaf != true).selectAll('.other').data(d=> d.other).join('circle').classed('other', true);
    
    otherCirc.attr('r', 4).attr('cx', 5).attr('cy', (c, i)=> {
         let y = d3.scaleLinear().domain([1, 0]);
         y.range([0, (height-5)]);
             return y(c.realVal);
         }).attr('fill', 'rgba(189, 195, 199, 0.1)');

    otherCirc.on("mouseover", function(d) {
         let tool = d3.select('#tooltip');
         tool.transition()
           .duration(200)
           .style("opacity", .9);
         let f = d3.format(".3f");
         tool.html(d.state + ": " + f(d.realVal))
           .style("left", (d3.event.pageX + 10) + "px")
           .style("top", (d3.event.pageY - 28) + "px");
         })
       .on("mouseout", function(d) {
         let tool = d3.select('#tooltip');
         tool.transition()
           .duration(500)
           .style("opacity", 0);
         });

    bCirc.on("mouseover", function(d) {
         let tool = d3.select('#tooltip');
         tool.transition()
           .duration(200)
           .style("opacity", .9);
         let f = d3.format(".3f");
         tool.html(d.state + ": " + f(d.realVal))
           .style("left", (d3.event.pageX + 10) + "px")
           .style("top", (d3.event.pageY - 28) + "px");
         })
       .on("mouseout", function(d) {
         let tool = d3.select('#tooltip');
         tool.transition()
           .duration(500)
           .style("opacity", 0);
         });
     
     /////AXIS ON HOVER////
    branchGrpDis.on('mouseover', (d, i, n)=> {
         let y = d3.scaleLinear().domain([1, 0]);
         y.range([0, (height-5)]);
         svg.selectAll('path.inner-line.'+ d.species).attr('stroke', 'red');
         svg.selectAll('path.inner-line.'+ d.species).classed('selected', true);
         d3.select(n[i]).append('g').classed('y-axis', true).call(d3.axisLeft(y).ticks(3));
         d3.select(n[i]).selectAll('.other').style('opacity', 0.7).attr('fill', (d)=> d.color);
         d3.select(n[i]).selectAll('.win-state').style('opacity', 0.7).attr('fill', (d)=> d.color);

     }).on('mouseout', (d, i, n)=> {
         d3.select(n[i]).select('g.y-axis')
         d3.select(n[i]).select('g.y-axis').remove();
         d3.selectAll('path.inner-line.'+ d.species).attr('stroke', 'gray');
         d3.selectAll('path.inner-line.'+ d.species).classed('selected', false);
         d3.selectAll('.other').attr('fill', 'rgba(189, 195, 199, 0.1)');
         d3.select(n[i]).selectAll('.win-state').filter(w=> w.shift != true).attr('fill', 'rgba(189, 195, 199, 0.3)');
     });

    let conGroup = speciesGrp.filter(sp=> {
         return sp.type === 'continuous';
     });

    let branchGrpCon = conGroup.selectAll('.branch').data(d=>d.paths).join('g').classed('branch', true);

    branchGrpCon.attr('transform', (d)=> {
      let x = d3.scaleLinear().domain([0, 1]).range([0, 800]);
          let distance = x(d.combLength);
          return 'translate('+distance+', 0)';
      });

      /////AXIS ON HOVER////
    branchGrpCon.on('mouseover', (d, i, n)=> {
         let y = d.yScale;
         y.range([0, (height-5)]);
         svg.selectAll('path.inner-line.'+ d.species).attr('stroke', 'red');
         svg.selectAll('path.inner-line.'+ d.species).classed('selected', true);
         d3.select(n[i]).append('g').classed('y-axis', true).call(d3.axisLeft(y).ticks(3));
         d3.select(n[i]).selectAll('.other').style('opacity', 0.7);
     }).on('mouseout', (d, i, n)=> {
         d3.select(n[i]).select('g.y-axis')
         d3.select(n[i]).select('g.y-axis').remove();
         d3.selectAll('path.inner-line.'+ d.species).attr('stroke', 'gray');
         d3.selectAll('path.inner-line.'+ d.species).classed('selected', false);
         d3.selectAll('.other').style('opacity', 0.1);
     });

     let MeanRect = branchGrpCon.append('rect');
     MeanRect.attr('width', dimensions.rectWidth).attr('height', 3);
     MeanRect.attr('y', (d, i) => {
         let scale = scales.filter(s=> s.field === d.label)[0];
        //  let min = scalingValues(scale.min);
        //  let max = scalingValues(scale.max);
         let min = scale.min;
         let max = scale.max;
         let y = generateTraitScale([min, max], [height-3, 0]);
        // let y = d3.scaleLinear().domain([min, max]).range([height-3, 0]);
         return y(d[valueParam]);
     });

     let confiBars = branchGrpCon.filter(f=> f.leaf != true).append('rect');

     confiBars
     .attr('width', dimensions.rectWidth)
     .attr('height', (d, i)=> {
         let scale = scales.filter(s=> s.field === d.label)[0];
         let min = scale.min;
         let max = scale.max;
         let y = generateTraitScale([min, max], [height, 0]);

         return y(+d.values.lowerCI95) - y(+d.values.upperCI95);
     });

     confiBars.attr('y', (d, i)=> {
         let scale = scales.filter(s=> s.field === d.label)[0];
         let y = d3.scaleLinear().domain([scale.min, scale.max]).range([height, 0]);
         return y(d.upperCI95);
     });
     confiBars.style('opacity', 0.1);
           
          
    }else{
            console.error('THIS HAS TO BE DISCRETE');
        }
        selectedTool.select('#show-drop-div-group').classed('show', false);
    });
    /////END SPLIT VIEW//////
    let svgTest = main.select('#main-path-view');
    let svg = svgTest.empty() ? main.append('svg').attr('id', 'main-path-view') : svgTest;
    svg.selectAll('*').remove();

    svg.attr('height', (stateBins.length * (height + 20)));
    svg.append('g').attr('transform', 'translate(500, 40)').append('text').text(stateBins[0].field)

    let wrappers = svg.selectAll('.grouped').data(stateBins).join('g').classed('grouped', true);
    wrappers.each((d, i, n)=> {
        let branchBar = drawBranchPointDistribution(d.data, d3.select(n[i]));
        branchBar.select('rect').attr('x', -80).attr('fill','gray');
        branchBar.selectAll('.branch-points').selectAll('circle').attr('fill', 'rgba(255, 255, 255, 0.3)');
        
        branchBar.select('.leaf-label').append('text').text((d, i) =>': '+ d.data.length).attr('transform', 'translate(45, 0)');
        branchBar.selectAll('text').style('font-size', '11.5px').style('fill', '#fff');

        branchBar.select('line').attr('stroke', '#fff');
    });

    let groupLabels = wrappers.append('g');
   

     //groupLabels.
     let pathAdd = groupLabels.append('g').classed("fas fa-search-plus", true);
     pathAdd.attr('transform', 'translate(20, -5)');
     pathAdd.append('circle').attr('r', 7).attr('fill', '#fff');
     pathAdd.append('text').text('+').attr('transform', 'translate(5, 3)').attr('fill', 'gray');
 
     pathAdd.style('cursor', 'pointer');

     pathAdd.on('click', (d, i, n)=> {
         let other = d3.selectAll(n).filter((f,j)=> j != i);
         renderComparison(d, other.data(), d3.select('#selected'), scales);
     });

     groupLabels.append('text').text((d, i)=> d.state);
     groupLabels.attr('transform', (d, i)=> 'translate(40, 16)');
     groupLabels.style('text-anchor', 'end');
     groupLabels.attr('fill', '#fff');

    let innerGroup = wrappers.append('g').classed('inner-wrap', true);
    innerGroup.attr('transform', (d,i)=> 'translate(110, 0)');

    let attWraps = innerGroup.selectAll('.att-wrapper').data((d, i)=> {
        let atts = formatAttributeData(d.data, scales, null);

       
        let attDataComb = atts[0].map((att, i)=> {
            let species = d.data[0].filter(f=> f.leaf === true)[0].label;
            att[att.length - 1].offset = 0;
            let attribute = {'label': att[att.length-1].label, 'type':att[att.length-1].type, 'data': [{'species': species, 'paths': att}]}
            for(let index = 1; index < atts.length; index++ ){
                let species = d.data[index].filter(f=> f.leaf === true)[0].label;
                let last = atts[index][i].length - 1;
                atts[index][i][last].offset = (index * 8);
                attribute.data.push({'species': species, 'paths': atts[index][i]})
            }
            return attribute;
        });

       let mappedDis = attDataComb.map(dis=> {
           dis.data = dis.data.map((spec, i)=> {
               spec.paths = spec.paths.map(m=> {
                if(dis.type === 'discrete'){
                    let offset = 5 * i;
                    let maxProb = m.states? {'realVal': 1.0, 'state': m.winState, 'color':m.color, 'combLength': m.combLength, 'offset':m.offset, 'leaf': true} : findMaxState(m, offset); 
                    return maxProb;
                }else{
                    return m;
                }
            });
            return spec;
           });
           return dis;
       });
       return mappedDis;
    }).join('g').classed('att-wrapper', true);

    let innerWrapRect = attWraps.append('rect').attr('width', 800);
    innerWrapRect.attr('height', height);
    innerWrapRect.style('fill', '#fff');
    innerWrapRect.style('stroke', 'gray');

    attWraps.attr('transform', (d, i)=> 'translate(0,'+((i * (height+5))+ 30)+')');
    wrappers.attr('transform', (d, i)=> 'translate(60,'+(i * (5 * (height+15))+ 50)+')');
    
    svg.attr('height', (wrappers.data().length * (5 * (height+15))+ 50));

       //END EXPERIMENT
    drawLeaves(attWraps, stateBins[0].field);

    let labels = attWraps.append('text')
    .text(d=> d.label)
    .style('text-anchor', 'end')
    .style('font-size', 11)
    labels.attr('transform', 'translate(-5,'+(50/2)+')');

    let speciesGrp = attWraps.selectAll('g.species').data(d=> {
        d.data = d.data.map(m=> {
            m.type = d.type;
            return m;
        });
        return d.data;
    }).join('g').classed('species', true);

    let lineGenD = d3.line()
       .x(d=> {
           let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 800]);
           let distance = d.combLength;
           return x(distance);
        })
       .y(d=> {
           let y = d3.scaleLinear().domain([0, 1]).range([height-2, 1]);
           return y(d.values.realVal);
       });

       let lineGenC = d3.line()
       .x(d=> {
           let x = d3.scaleLinear().domain([0, 1]).range([0, 800]);
           let distance = d.combLength;
           return x(distance);
        })
       .y(d=> {
           let y = d.yScale;
           y.range([height-2, 1]);
           return y(d.values.realVal) + 2;
       });

       let innerStatePaths = speciesGrp.append('path')
       .attr("d", d=> {
            return (d.type === 'discrete') ? lineGenD(d.paths) : lineGenC(d.paths);
        })
       .attr("class", (d, i)=> {
            return d.species + " inner-line"})
       .style('stroke-width', 0.7)
       .style('fill', 'none')
       .style('stroke', 'gray');

       innerStatePaths.on('mouseover', (d, i, n)=> {
        d3.select(n[i]).classed('selected', true);
    }).on('mouseout', (d, i, n)=> {
         d3.select(n[i]).classed('selected', false);
    });

    let disGroup = speciesGrp.filter(sp=> {
     return sp.type === 'discrete';
     });

    let branchGrpDis = disGroup.selectAll('.branch').data(d=>d.paths).join('g').classed('branch', true);

    branchGrpDis.attr('transform', (d)=> {
        let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 800]);
            let distance = x(d.combLength);
            return 'translate('+distance+', 0)';
     });

    let bCirc = branchGrpDis.append('circle').attr('r', 5).attr('cy', (d, i)=> {
         let y = d3.scaleLinear().domain([0, 1]).range([height - 5, 2]);
         //return y(d.realVal) + d.offset;
         return y(d.values.realVal);
     }).attr('cx', 5);

     bCirc.classed('win-state', true);

     bCirc.attr('fill', (d, i, n)=> {
        if(i === 0 || i === n.length - 1){
            return d.color;
            /*
        }else if(i === n.length - 1){
            if(d.state === d3.select(n[i-1]).data()[0].state){
                return 'rgba(189, 195, 199, 0.3)';
            }else{
                d.shift = true;
                return d.color;
            }*/
        }else{
            if(d.state === d3.select(n[i+1]).data()[0].state || d.state === d3.select(n[i-1]).data()[0].state){
                return 'rgba(189, 195, 199, 0.3)';
            }else{
                d.shift = true;
                return d.color;
            }
        }
     });

    let otherCirc = branchGrpDis.filter(f=> f.leaf != true).selectAll('.other').data(d=> d.other).join('circle').classed('other', true);
    
    otherCirc.attr('r', 4).attr('cx', 5).attr('cy', (c, i)=> {
         let y = d3.scaleLinear().domain([1, 0]);
         y.range([0, (height-5)]);
             return y(c.realVal);
         }).attr('fill', 'rgba(189, 195, 199, 0.1)');

    otherCirc.on("mouseover", function(d) {
         let tool = d3.select('#tooltip');
         tool.transition()
           .duration(200)
           .style("opacity", .9);
         let f = d3.format(".3f");
         tool.html(d.state + ": " + f(d.realVal))
           .style("left", (d3.event.pageX + 10) + "px")
           .style("top", (d3.event.pageY - 28) + "px");
         })
       .on("mouseout", function(d) {
         let tool = d3.select('#tooltip');
         tool.transition()
           .duration(500)
           .style("opacity", 0);
         });

    bCirc.on("mouseover", function(d) {
         let tool = d3.select('#tooltip');
         tool.transition()
           .duration(200)
           .style("opacity", .9);
         let f = d3.format(".3f");
         tool.html(d.state + ": " + f(d.realVal))
           .style("left", (d3.event.pageX + 10) + "px")
           .style("top", (d3.event.pageY - 28) + "px");
         })
       .on("mouseout", function(d) {
         let tool = d3.select('#tooltip');
         tool.transition()
           .duration(500)
           .style("opacity", 0);
         });
     
     /////AXIS ON HOVER////
    branchGrpDis.on('mouseover', (d, i, n)=> {
         let y = d3.scaleLinear().domain([1, 0]);
         y.range([0, (height-5)]);
         svg.selectAll('path.inner-line.'+ d.species).attr('stroke', 'red');
         svg.selectAll('path.inner-line.'+ d.species).classed('selected', true);
         d3.select(n[i]).append('g').classed('y-axis', true).call(d3.axisLeft(y).ticks(3));
         d3.select(n[i]).selectAll('.other').style('opacity', 0.7).attr('fill', (d)=> d.color);
         d3.select(n[i]).selectAll('.win-state').style('opacity', 0.7).attr('fill', (d)=> d.color);

     }).on('mouseout', (d, i, n)=> {
         d3.select(n[i]).select('g.y-axis')
         d3.select(n[i]).select('g.y-axis').remove();
         d3.selectAll('path.inner-line.'+ d.species).attr('stroke', 'gray');
         d3.selectAll('path.inner-line.'+ d.species).classed('selected', false);
         d3.selectAll('.other').attr('fill', 'rgba(189, 195, 199, 0.1)');
         d3.select(n[i]).selectAll('.win-state').filter(w=> w.shift != true).attr('fill', 'rgba(189, 195, 199, 0.3)');
     });

    let conGroup = speciesGrp.filter(sp=> {
         return sp.type === 'continuous';
     });

    let branchGrpCon = conGroup.selectAll('.branch').data(d=>d.paths).join('g').classed('branch', true);

    branchGrpCon.attr('transform', (d)=> {
      let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 750]);
          let distance = x(d.combLength);
          return 'translate('+distance+', 0)';
      });

      /////AXIS ON HOVER////
     branchGrpCon.on('mouseover', (d, i, n)=> {
         let y = d.yScale;
         y.range([0, (height-5)]);
         svg.selectAll('path.inner-line.'+ d.species).attr('stroke', 'red');
         svg.selectAll('path.inner-line.'+ d.species).classed('selected', true);
         d3.select(n[i]).append('g').classed('y-axis', true).call(d3.axisLeft(y).ticks(3));
         d3.select(n[i]).selectAll('.other').style('opacity', 0.7);

     }).on('mouseout', (d, i, n)=> {
         d3.select(n[i]).select('g.y-axis')
         d3.select(n[i]).select('g.y-axis').remove();
         d3.selectAll('path.inner-line.'+ d.species).attr('stroke', 'gray');
         d3.selectAll('path.inner-line.'+ d.species).classed('selected', false);
         d3.selectAll('.other').style('opacity', 0.1);
     });

     let MeanRect = branchGrpCon.append('rect');
     MeanRect.attr('width', dimensions.rectWidth).attr('height', 3);
     MeanRect.attr('y', (d, i) => {
         let scale = scales.filter(s=> s.field === d.label)[0];
         let y = d3.scaleLinear().domain([scale.min, scale.max]).range([height, 0])
         return y(d.realVal);
     });

     let confiBars = branchGrpCon.filter(f=> f.leaf != true).append('rect');
     confiBars.attr('width', dimensions.rectWidth).attr('height', (d, i)=> {
         let scale = scales.filter(s=> s.field === d.label)[0];
         let y = d3.scaleLinear().domain([scale.min, scale.max]).range([height, 0]);
         return y(d.lowerCI95) - y(d.upperCI95);
     });

     confiBars.attr('y', (d, i)=> {
         let scale = scales.filter(s=> s.field === d.label)[0];
         let y = d3.scaleLinear().domain([scale.min, scale.max]).range([height, 0]);
         return y(d.upperCI95);
     })
     confiBars.style('opacity', 0.1);

     /////HIGHLIGHTING NODES IN A TREE ON HOVER//////
     d3.selectAll('.att-wrapper').selectAll('.branch').on('mouseover', (d, i, n)=> {
         let treeNode  = d3.select('#sidebar').selectAll('.node');
        treeNode.filter(f=> {
            return d.node === f.data.node;
        }).classed('selected', true);
      
    }).on('mouseout', (d, i, n)=> {
       
        let treeNode  = d3.select('#sidebar').selectAll('.node');

        treeNode.filter(f=> {
            return d.node === f.data.node;
        }).classed('selected', false);
    })
     
}
export function drawDiscreteAtt(predictedAttrGrps, collapsed, bars, width){

    let discreteAtt = predictedAttrGrps.filter(d=> {
        return d[d.length - 1].type === 'discrete';
    });

    let attributeHeight = (collapsed === 'true')? 20 : 45;

    let innerTimelineDis = discreteAtt.append('g').classed('attribute-time-line', true);

    innerTimelineDis.append('line').classed('half', true).attr('x1', 0).attr('y1', 22).attr('x2', width).attr('y2', 22);
    
    let statePath = innerTimelineDis.selectAll('g').data(d=> {
        
        let disct = d;
       
        let keys = disct[0].map(s=> s.state);
        let lines = keys.map(key=> {
             return disct.map(m=> m.leaf ? m : m.filter(f=> f.state == key)[0]);
        });
        return lines;
    }).join('g').classed('state-path', true);

    var lineGen = d3.line()
    .x(d=> {
        let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, width-10]);
        let distance = x(d.combLength);
        return distance + 7;})
    .y(d=> {
        let y = d3.scaleLinear().domain([0, 1]).range([attributeHeight-2, 1]);
        return d.value ? y(d.value) : y(1);
    });

    let innerStatePaths = statePath.append('path')
    .attr("d", lineGen)
    .attr("class", (d, i)=> d[0].species + " inner-line")
    .style('stroke-width', 0.7)
    .style('stroke', (d)=> {
        return d[0].color;
    });

    let attribRectDisc = innerTimelineDis.append('rect').classed('attribute-rect', true);
    attribRectDisc.attr('height', attributeHeight);
    attribRectDisc.attr('width', width);
    let attributeNodesDisc = innerTimelineDis.selectAll('.attribute-node-discrete').data(d=> {
        return d;}).join('g');

    attributeNodesDisc.attr('transform', (d)=> {
        let x = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, width-10]);
        if(d[0]){
           let distance = x(d[0].combLength);
            return 'translate('+distance+', 0)';
        }else{
            let distance = x(d.combLength);
            return 'translate('+distance+', 0)';
        }
    });

    attributeNodesDisc.append('rect').attr('width', dimensions.rectWidth).attr('height', attributeHeight).attr('opacity', 0);

    attributeNodesDisc.append('line').attr('x1', 10).attr('x2', 10).attr('y1', 0).attr('y2', attributeHeight);

        /////AXIS ON HOVER////
    attributeNodesDisc.on('mouseover', (d, i, n)=> {
            let y = d3.scaleLinear().domain([1, 0]);
            y.range([0, attributeHeight]);
            d3.select(n[i]).append('g').classed('y-axis', true).call(d3.axisLeft(y).ticks(3));
        }).on('mouseout', (d, i, n)=> {
            d3.select(n[i]).select('g.y-axis')
            d3.select(n[i]).select('g.y-axis').remove();
        })

    attributeNodesDisc.attr('class', (d, i, n)=> {
        let path = d3.selectAll(n).data();
        return path[path.length - 1].species;
    }).classed('attribute-node-discrete', true);

    if(bars === false){

        let stateDots = attributeNodesDisc.filter((att, i)=> att[0] != undefined).selectAll('.dots').data(d=> {
            return d;
        }).join('circle').classed('dots', true);
        
        stateDots.attr('cx', 10).attr('cy', (d)=> {
            let y = d3.scaleLinear().domain([0, 1]).range([attributeHeight - 2, 2]);
            return d.realVal? y(d.realVal) : y(d.value);
        }).attr('r', 2);
        
        stateDots.style('fill', (d, i, n)=> {
           
            /*
            let speciesPath = d3.selectAll('.attribute-node-discrete.'+ d.species)//.filter(f=> f.type === 'discrete');
           
            let nodeArray = speciesPath.data().map(m=> {
                return m.node ? m.node : m[0].node;
            });
            let index = nodeArray.indexOf(d.node);
           
            */
            //return d.color
            return 'gray';
        });
    
        stateDots.filter(f=> f.realVal > 0.5).attr('r', 4);
/*
        let maxDots = stateDots.filter((f, i, n)=> {
           
            return f.realVal === d3.max(d3.selectAll(n).data().map(m=> m.realVal));
        });
*/
        

        ////NEED TO ADD COLOR ON STATE CHANGE////
    
        stateDots.on("mouseover", function(d) {
            let tool = d3.select('#tooltip');
            tool.transition()
              .duration(200)
              .style("opacity", .9);
            let f = d3.format(".3f");
            tool.html(d.state + ": " + f(d.realVal))
              .style("left", (d3.event.pageX) + "px")
              .style("top", (d3.event.pageY - 28) + "px");
            })
          .on("mouseout", function(d) {
            let tool = d3.select('#tooltip');
            tool.transition()
              .duration(500)
              .style("opacity", 0);
            });
    
        let endStateDot = attributeNodesDisc.filter((att, i)=> {
            return att[0] === undefined;}).classed('discrete-leaf', true);
    
        endStateDot.append('circle').attr('cx', 10).attr('cy', 2).attr('r', 7).style('fill', d=> {
           return d.color;
        });
        ////NEED TO MAKE A FUNCTION TO ASSIGN COLOR OF STATES//////
    
        endStateDot.append('text').text(d=> d.winState).attr('transform', 'translate(20, 5)').style('font-size', 10);

    }else{
        attributeNodesDisc.filter((att, i)=> {
            return att[0] != undefined;}).append('rect').attr('height', attributeHeight).attr('width', dimensions.rectWidth).attr('fill', '#fff')
        let stateBars = attributeNodesDisc.filter((att, i)=> att[0] != undefined).selectAll('.dis-rect').data(d=> {
            return d;
        }).join('rect').classed('dis-rect', true);

        stateBars.attr('width', dimensions.rectWidth).attr('height', (d, i)=> {
            let y = d3.scaleLinear().domain([0, 1]).range([0, attributeHeight]);
            return y(d.realVal);
        });

        stateBars.attr('fill', (d, i)=> d.color);
        stateBars.attr('opacity', '0.7');
        stateBars.attr('stroke', '#fff');
        stateBars.attr('transform', (d, i, n)=> {
            let y = d3.scaleLinear().domain([0, 1]).range([0, attributeHeight]);
            let probability = d3.selectAll(n).data().sort((a, b)=> b.realVal - a.realVal);
            let chosenIn = probability.map(p=> p.state).indexOf(d.state);
         
            if(chosenIn === 0){
                    return 'translate(0,0)';
            }else{
                ///need to make this a reduce function///
                let valueAdd = 0;
                    for(let step = 0; step < chosenIn; step++){
                        valueAdd = valueAdd + probability[step].realVal;
                    }
                return 'translate(0,'+(y(valueAdd))+')';
            }
        });

        stateBars.on("mouseover", function(d) {
            let tool = d3.select('#tooltip');
            tool.transition()
              .duration(200)
              .style("opacity", .9);
            let f = d3.format(".3f");
            tool.html(d.state + ": " + f(d.realVal))
              .style("left", (d3.event.pageX) + "px")
              .style("top", (d3.event.pageY - 28) + "px");
            })
          .on("mouseout", function(d) {
            let tool = d3.select('#tooltip');
            tool.transition()
              .duration(500)
              .style("opacity", 0);
            });
    
        let endStateDot = attributeNodesDisc.filter((att, i)=> {
            return att[0] === undefined;}).classed('discrete-leaf', true);
    
        endStateDot.append('circle').attr('cx', 10).attr('cy', 2).attr('r', 7).style('fill', d=> {
           return d.color;
        });

        endStateDot.append('text').text(d=> d.winState).attr('transform', 'translate(20, 5)').style('font-size', 10);

    }

    return attributeNodesDisc;
}

