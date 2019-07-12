import '../styles/index.scss';
import {formatAttributeData} from './dataFormat';
import {renderAttributes,  drawContAtt, drawDiscreteAtt, renderPaths} from './rendering';
import * as d3 from "d3";

export function toolbarControl(toolbar, normedPaths, main, calculatedScales){
    let button = toolbar.append('button').attr('id', 'view-toggle').attr('attr' , 'button').attr('class', 'btn btn-outline-secondary') 
    button.text('View Paths');
    button.on('click', function(){
        if(button.text() === 'View Paths'){
            button.text('View Summary');
            main.selectAll('*').remove();//.selectAll('*').remove();

            ////NEED TO SIMPLIFY THIS///////
            let pathGroups = renderPaths(normedPaths, main);

              /// LOWER ATTRIBUTE VISUALIZATION ///
            let attributeWrapper = pathGroups.append('g').classed('attribute-wrapper', true);
            let attData = formatAttributeData(normedPaths, calculatedScales)
            let predictedAttrGrps = renderAttributes(attributeWrapper, attData, calculatedScales, null);
        
            let attributeHeight = 45;
            pathGroups.attr('transform', (d, i)=> 'translate(10,'+ (i * ((attributeHeight + 5)* (Object.keys(d[1].attributes).length + 1))) +')');
            // renderToggles(normedPaths, toggleSVG, predictedAttrGrps, calculatedScales);
            drawContAtt(predictedAttrGrps);
            drawDiscreteAtt(predictedAttrGrps, calculatedScales);

            //tranforming elements
            main.select('#main-path-view').style('height', ((normedPaths.length + predictedAttrGrps.data().map(m=> m[0]).length)* 30) + 'px');
            attributeWrapper.attr('transform', (d)=> 'translate(140, 25)');
            ///////////////////////////////////

        }else{
            button.text('View Paths');
            main.selectAll('*').remove();
            renderDistibutions(normedPaths, main, calculatedScales)

        }
    })
}

export function renderToggles(normedPaths, toggleSVG, scales){

    let keys = Object.keys(normedPaths[0][0].attributes);

    let labelGroups = toggleSVG.selectAll('g').data(keys);
    let labelGroupEnter = labelGroups.enter().append('g'); 
    
    labelGroupEnter.attr('transform', (d, i)=> {
        return 'translate('+ ( (i* 100) + (d.length * 2))+', 20)'});

    let toggle = labelGroupEnter.append('circle').attr('cx', -10).attr('cy', -4);
    toggle.classed('toggle shown', true);
    toggle.style('fill', (d, i)=>{
        return scales.filter(f=> f.field === d)[0].catColor;
    });
    toggle.on('click', function(d, i){
        let togg = d3.select(this);
        toggleCircle(togg, scales);
        let newKeys = d3.selectAll('.shown');
        let attributeWrapper = d3.selectAll('.attribute-wrapper');
        attributeWrapper.selectAll('g').remove();
        let attributeHeight = 45;
      
          /// LOWER ATTRIBUTE VISUALIZATION ///
      
        let attData =  formatAttributeData(normedPaths, scales, newKeys.data());
        let predictedAttrGrps = renderAttributes(attributeWrapper, attData, scales, null);

        d3.select('#main-path-view').style('height', ((normedPaths.length + predictedAttrGrps.data().map(m=> m[0]).length)* 30) + 'px');
        d3.selectAll('.paths').attr('transform', (d, i)=> 'translate(10,'+ (i * ((attributeHeight + 5)* (newKeys.data().length + 1))) +')');
    
        drawContAtt(predictedAttrGrps);
        drawDiscreteAtt(predictedAttrGrps, scales);

    });
    let labelText = labelGroupEnter.append('text').text(d=> d).style('font-size', 10);
    labelGroups = labelGroupEnter.merge(labelGroups);
}

function toggleCircle(circle, scales){
    if(circle.classed('shown')){
        circle.classed('shown', false);
        circle.style('fill', '#fff');
    }else{
        circle.classed('shown', true);
        circle.style('fill', (d, i)=>{
            return scales.filter(f=> f.field === d)[0].catColor;
        });
    }
}